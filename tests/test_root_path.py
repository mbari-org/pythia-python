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


def test_root_path_special_chars_are_html_escaped():
    with TestClient(app, root_path='/x"><script>alert(1)</script>') as client:
        response = client.get("/")
    assert '"><script>' not in response.text
    assert "&lt;script&gt;" in response.text


def test_health_endpoint():
    with TestClient(app) as client:
        response = client.get("/q/health")
    assert response.status_code == 200
    assert response.json()["status"] == "UP"
