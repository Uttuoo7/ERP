"""
tests/test_health.py
Sanity check — verify the API is reachable and returns expected structure.
"""
import pytest


@pytest.mark.api
def test_health_check(client):
    """API health endpoint should return 200 with status=ok."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "message" in data


@pytest.mark.api
def test_health_check_content_type(client):
    """Health endpoint should return JSON content type."""
    response = client.get("/api/health")
    assert "application/json" in response.headers.get("content-type", "")


@pytest.mark.api
def test_nonexistent_route_returns_404(client):
    """Requests to non-existent API routes should return 404."""
    response = client.get("/api/this-does-not-exist")
    assert response.status_code == 404
