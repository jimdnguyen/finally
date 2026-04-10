"""Unit tests for health check endpoint."""

import json

import pytest


def test_health_check(client):
    """Test successful health check response.

    Verifies that GET /api/health returns 200 with the expected JSON schema:
    - status: "healthy"
    - database: "connected"
    - timestamp: ISO 8601 format
    """
    response = client.get("/api/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert "timestamp" in data

    # Verify timestamp is ISO 8601 format (basic check)
    timestamp = data["timestamp"]
    assert isinstance(timestamp, str)
    assert "T" in timestamp
    assert ("Z" in timestamp or "+" in timestamp or "-" in timestamp)


def test_health_check_database_error(client, test_db, monkeypatch):
    """Test health check when database is unavailable.

    Mocks the database to raise an exception and verifies the health endpoint
    returns 503 with status="unhealthy" and database="error".
    """
    # Close the database connection to simulate unavailability
    test_db.close()

    # Attempt health check with closed database
    response = client.get("/api/health")
    assert response.status_code == 503

    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["database"] == "error"
    assert "timestamp" in data
