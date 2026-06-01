# Context Path Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Pythia to be served behind a reverse proxy at a sub-path (e.g., `/pythia`) via a `ROOT_PATH` environment variable, with no behavioral change when the variable is unset.

**Architecture:** FastAPI's built-in `root_path` handles the Swagger UI side; a `<base>` tag injected into `index.html` at request time makes all browser-side asset and fetch URLs resolve correctly against the sub-path. All hardcoded absolute paths in HTML and JS become relative so the `<base>` tag governs resolution.

**Tech Stack:** Python 3.11+, FastAPI, Starlette `TestClient`, pytest

---

## File Map

| File | Change |
|---|---|
| `main.py` | Read `ROOT_PATH` env var; pass to `FastAPI(root_path=...)`; change `GET /` to inject `<base>` tag; pass to `uvicorn.run(root_path=...)` |
| `static/index.html` | Remove leading `/` from 5 asset/nav references |
| `static/scripts/model-server.js` | Change `fetch("/predictor", ...)` to `fetch("predictor", ...)` |
| `tests/test_root_path.py` | New — tests for `GET /` base-tag injection behaviour |
| `requirements-dev.txt` | New — dev dependencies (`pytest`, `httpx`) |

---

## Task 1: Add dev dependencies and test scaffold

**Files:**
- Create: `requirements-dev.txt`
- Create: `tests/test_root_path.py`

- [ ] **Step 1: Create `requirements-dev.txt`**

```
pytest>=8.0.0
httpx>=0.27.0
```

`httpx` is required by Starlette's `TestClient`.

- [ ] **Step 2: Install dev dependencies**

```bash
pip install -r requirements-dev.txt
```

Expected: packages install without error.

- [ ] **Step 3: Write failing tests in `tests/test_root_path.py`**

```python
import pytest
from fastapi.testclient import TestClient
from main import app


def test_root_no_context_path_serves_html():
    with TestClient(app) as client:
        response = client.get("/")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")


def test_root_no_context_path_has_base_tag():
    with TestClient(app) as client:
        response = client.get("/")
    assert '<base href="/">' in response.text


def test_root_with_context_path_has_prefixed_base_tag():
    with TestClient(app, root_path="/pythia") as client:
        response = client.get("/")
    assert '<base href="/pythia/">' in response.text


def test_root_with_trailing_slash_context_path_normalises():
    """root_path with a trailing slash should not produce double slash."""
    with TestClient(app, root_path="/pythia/") as client:
        response = client.get("/")
    assert '<base href="/pythia/">' in response.text
    assert '<base href="/pythia//">' not in response.text


def test_health_endpoint():
    with TestClient(app) as client:
        response = client.get("/q/health")
    assert response.status_code == 200
    assert response.json()["status"] == "UP"
```

- [ ] **Step 4: Run tests to confirm they fail**

```bash
pytest tests/test_root_path.py -v
```

Expected: all tests fail — `GET /` still returns a `FileResponse`, not an `HTMLResponse` with a `<base>` tag.

---

## Task 2: Update `main.py`

**Files:**
- Modify: `main.py`

- [ ] **Step 1: Add `os` import and read `ROOT_PATH` env var**

At the top of `main.py`, after the stdlib imports and before the third-party imports, add:

```python
import os
```

Then, directly after all imports (before the `# Global state` comment), add:

```python
root_path = os.environ.get("ROOT_PATH", "")
```

- [ ] **Step 2: Update FastAPI imports**

Replace:
```python
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
```

With:
```python
from fastapi import FastAPI, File, Request, UploadFile, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
```

- [ ] **Step 3: Pass `root_path` to the `FastAPI(...)` constructor**

Replace:
```python
app = FastAPI(
    title="Pythia",
    description="Web service for YOLO object detection predictions",
    version="1.0.0",
    lifespan=lifespan
)
```

With:
```python
app = FastAPI(
    title="Pythia",
    description="Web service for YOLO object detection predictions",
    version="1.0.0",
    lifespan=lifespan,
    root_path=root_path,
)
```

- [ ] **Step 4: Replace the `GET /` handler**

Replace the entire existing `root()` function:

```python
@app.get("/")
async def root():
    """Serve the main page - redirect to index.html."""
    from fastapi.responses import FileResponse
    index_path = static_dir / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "Pythia API is running. Use /docs for API documentation."}
```

With:

```python
@app.get("/")
async def root(request: Request):
    """Serve the main page with a <base> tag for correct sub-path resolution."""
    index_path = static_dir / "index.html"
    if index_path.exists():
        rp = request.scope.get("root_path", "").rstrip("/")
        html = index_path.read_text()
        html = html.replace("<head>", f'<head>\n  <base href="{rp}/">', 1)
        return HTMLResponse(content=html)
    return {"message": "Pythia API is running. Use /docs for API documentation."}
```

- [ ] **Step 5: Pass `root_path` to `uvicorn.run()`**

Replace:
```python
    uvicorn.run(app, host=args.host, port=args.port)
```

With:
```python
    uvicorn.run(app, host=args.host, port=args.port, root_path=root_path)
```

- [ ] **Step 6: Run the tests — they should now pass**

```bash
pytest tests/test_root_path.py -v
```

Expected output:
```
tests/test_root_path.py::test_root_no_context_path_serves_html PASSED
tests/test_root_path.py::test_root_no_context_path_has_base_tag PASSED
tests/test_root_path.py::test_root_with_context_path_has_prefixed_base_tag PASSED
tests/test_root_path.py::test_root_with_trailing_slash_context_path_normalises PASSED
tests/test_root_path.py::test_health_endpoint PASSED
```

- [ ] **Step 7: Commit**

```bash
git add main.py tests/test_root_path.py requirements-dev.txt
git commit -m "feat: inject <base> tag and wire root_path for context-path support"
```

---

## Task 3: Make asset paths in `static/index.html` relative

**Files:**
- Modify: `static/index.html`

The `<base>` tag injected by the server makes all relative URLs resolve against the context path. Each absolute path (leading `/`) must become relative (no leading `/`) so the browser applies the base.

- [ ] **Step 1: Change the stylesheet link (line 10)**

Replace:
```html
  <link href="/static/styles.css" rel="stylesheet">
```
With:
```html
  <link href="static/styles.css" rel="stylesheet">
```

- [ ] **Step 2: Change the MBARI logo `src` (line 24)**

Replace:
```html
        <img src="/static/logo-mbari-3b.png" alt="MBARI" class="mbari-logo">
```
With:
```html
        <img src="static/logo-mbari-3b.png" alt="MBARI" class="mbari-logo">
```

- [ ] **Step 3: Change the API Docs nav link (line 29)**

Replace:
```html
        <a class="quick-link" href="/docs">API Docs</a>
```
With:
```html
        <a class="quick-link" href="docs">API Docs</a>
```

- [ ] **Step 4: Change the Health nav link (line 30)**

Replace:
```html
        <a class="quick-link" href="/q/health">Health</a>
```
With:
```html
        <a class="quick-link" href="q/health">Health</a>
```

- [ ] **Step 5: Change the JS script `src` (line 174)**

Replace:
```html
  <script src="/static/scripts/model-server.js"></script>
```
With:
```html
  <script src="static/scripts/model-server.js"></script>
```

- [ ] **Step 6: Commit**

```bash
git add static/index.html
git commit -m "feat: use relative asset paths so <base> tag governs resolution"
```

---

## Task 4: Make the `fetch` call in `model-server.js` relative

**Files:**
- Modify: `static/scripts/model-server.js`

- [ ] **Step 1: Change the `fetch` URL (line 315)**

Replace:
```javascript
      fetch("/predictor", requestOptions)
```
With:
```javascript
      fetch("predictor", requestOptions)
```

- [ ] **Step 2: Commit**

```bash
git add static/scripts/model-server.js
git commit -m "feat: use relative fetch URL so context path is inherited from page base"
```

---

## Task 5: Smoke-test the full change

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
pytest tests/ -v
```

Expected: all 5 tests pass.

- [ ] **Step 2: Verify the base tag with no `ROOT_PATH` set**

Start the server (requires a real model file):
```bash
python main.py /path/to/model.pt --port 8080
```

Fetch the root page and inspect the `<base>` tag:
```bash
curl -s http://localhost:8080/ | grep '<base'
```

Expected:
```html
  <base href="/">
```

- [ ] **Step 3: Verify the base tag with `ROOT_PATH=/pythia`**

```bash
ROOT_PATH=/pythia python main.py /path/to/model.pt --port 8080
```

```bash
curl -s http://localhost:8080/ | grep '<base'
```

Expected:
```html
  <base href="/pythia/">
```
