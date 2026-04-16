from fastapi.testclient import TestClient

from app.main import app


def test_health():
    c = TestClient(app)
    r = c.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_ready():
    c = TestClient(app)
    r = c.get("/ready")
    assert r.status_code == 200
    assert r.json()["status"] == "ready"
