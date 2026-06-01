# Context Path Support Design

**Date:** 2026-06-01  
**Status:** Approved

## Problem

When Pythia is deployed behind a reverse proxy at a sub-path (e.g., `my.server.com/pythia`), all
absolute paths in the HTML and JavaScript break. The browser sends requests to `my.server.com/static/...`
and `my.server.com/predictor` instead of `my.server.com/pythia/static/...` and
`my.server.com/pythia/predictor`.

## Solution Overview

Use FastAPI/Starlette's built-in `root_path` mechanism combined with an HTML `<base>` tag injected at
request time. The `root_path` fixes the Swagger UI automatically; the `<base>` tag makes all relative
asset and fetch URLs resolve correctly in the browser.

## Configuration

- **Env var:** `ROOT_PATH` (e.g., `ROOT_PATH=/pythia`). Defaults to `""`.
- Passed to `FastAPI(root_path=root_path)` — fixes `/docs` Swagger UI links.
- Passed to `uvicorn.run(root_path=root_path)` — propagates through the ASGI scope.
- When `ROOT_PATH` is unset or empty, behavior is identical to today (served at `/`).

## Changes

### `main.py`

1. Read `ROOT_PATH` env var at module level:
   ```python
   import os
   root_path = os.environ.get("ROOT_PATH", "")
   ```

2. Pass to `FastAPI(...)`:
   ```python
   app = FastAPI(..., root_path=root_path)
   ```

3. Pass to `uvicorn.run(...)`:
   ```python
   uvicorn.run(app, host=args.host, port=args.port, root_path=root_path)
   ```

4. Change `GET /` from `FileResponse` to dynamic HTML injection:
   ```python
   from fastapi import Request
   from fastapi.responses import HTMLResponse

   @app.get("/")
   async def root(request: Request):
       rp = request.scope.get("root_path", "").rstrip("/")
       index_path = static_dir / "index.html"
       if index_path.exists():
           html = index_path.read_text()
           html = html.replace("<head>", f'<head>\n  <base href="{rp}/">', 1)
           return HTMLResponse(content=html)
       return {"message": "Pythia API is running. Use /docs for API documentation."}
   ```

   Reading `root_path` from the request scope (rather than the env var directly) means the handler
   works correctly whether `root_path` was set via env var, `--root-path` CLI flag, or any other ASGI
   mechanism.

### `static/index.html`

Remove the leading `/` from all internal asset and navigation references so they resolve relative to
the `<base>` tag:

| Before | After |
|---|---|
| `/static/styles.css` | `static/styles.css` |
| `/static/logo-mbari-3b.png` | `static/logo-mbari-3b.png` |
| `/static/scripts/model-server.js` | `static/scripts/model-server.js` |
| `/docs` | `docs` |
| `/q/health` | `q/health` |

### `static/scripts/model-server.js`

| Before | After |
|---|---|
| `fetch("/predictor", requestOptions)` | `fetch("predictor", requestOptions)` |

## Reverse Proxy Requirements

The proxy must strip the sub-path prefix before forwarding to Pythia. Example nginx config:

```nginx
location /pythia/ {
    proxy_pass http://localhost:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

The trailing slash on both `location /pythia/` and `proxy_pass http://localhost:8080/` is what strips
the prefix. The app itself does not need to know the proxy's external hostname.

## Behavior at Root (No Context Path)

When `ROOT_PATH` is not set:
- `<base href="/">` is injected — identical resolution to the current absolute paths.
- All endpoints remain at `/predict`, `/predictor`, `/q/health`, `/docs`.
- No behavioral change for direct (non-proxied) deployments.

## Out of Scope

- Multiple simultaneous context paths.
- Dynamic prefix detection from `X-Forwarded-Prefix` headers (the env var is explicit and simpler).
- Docker / `justfile` changes (operators already set env vars for Docker deployments).
