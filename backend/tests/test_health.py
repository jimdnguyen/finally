"""Tests for the health endpoint."""

from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.db import init_db


@pytest.fixture
def mock_market_source(monkeypatch):
    """Replace module-level market_source with a no-op mock."""
    mock = AsyncMock()
    mock.start = AsyncMock()
    mock.stop = AsyncMock()
    monkeypatch.setattr("app.main.market_source", mock)
    return mock


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    """Redirect DB paths to a temp file."""
    db_file = tmp_path / "test.db"
    monkeypatch.setattr("app.db.init.DB_PATH", db_file)
    monkeypatch.setattr("app.db.connection.DB_PATH", db_file)
    monkeypatch.setattr("app.main.DB_PATH", db_file)
    return db_file


async def test_health_returns_ok(mock_market_source, temp_db):
    await init_db()

    from app.main import create_app

    test_app = create_app()
    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as client:
        response = await client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
