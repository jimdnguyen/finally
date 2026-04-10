"""Tests for health check endpoint."""


def test_health(client):
    """Test GET /api/health returns 200."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
