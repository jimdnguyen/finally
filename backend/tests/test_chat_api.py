"""Router-level tests for POST /api/chat."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.db import init_db


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    monkeypatch.setattr("app.db.config.DB_PATH", tmp_path / "test.db")


@pytest.fixture
def mock_market_source(monkeypatch):
    mock = AsyncMock()
    mock.start = AsyncMock()
    mock.stop = AsyncMock()
    mock.add_ticker = AsyncMock()
    mock.remove_ticker = AsyncMock()
    monkeypatch.setattr("app.main.market_source", mock)
    return mock


@pytest.fixture
def mock_price_cache(monkeypatch):
    prices = {"AAPL": 150.0}

    class FakePriceCache:
        def get_price(self, ticker):
            return prices.get(ticker)
        def get(self, ticker):
            return None
        def get_all(self):
            return {}
        @property
        def version(self):
            return 0
        def update(self, ticker, price, timestamp=None):
            prices[ticker] = price

    fake = FakePriceCache()
    monkeypatch.setattr("app.main.price_cache", fake)
    return fake


@pytest.fixture
async def client(mock_market_source, mock_price_cache):
    await init_db()
    from app.main import create_app
    test_app = create_app()
    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as c:
        yield c


async def test_chat_empty_message_rejected(client):
    response = await client.post("/api/chat", json={"message": ""})
    assert response.status_code == 422


async def test_chat_missing_message_rejected(client):
    response = await client.post("/api/chat", json={})
    assert response.status_code == 422


async def test_chat_message_too_long_rejected(client):
    response = await client.post("/api/chat", json={"message": "x" * 2001})
    assert response.status_code == 422


async def test_chat_mock_mode_endpoint(client, monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "true")
    response = await client.post("/api/chat", json={"message": "Hello"})
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "trades_executed" in data
    assert "watchlist_changes_applied" in data
    assert isinstance(data["trades_executed"], list)


async def test_chat_503_from_router(client, monkeypatch):
    """LLM failure propagates as HTTP 503 with LLM_ERROR code (AC1)."""
    monkeypatch.delenv("LLM_MOCK", raising=False)
    with patch(
        "app.chat.service.litellm.acompletion",
        new_callable=AsyncMock,
        side_effect=Exception("API down"),
    ):
        response = await client.post("/api/chat", json={"message": "Hello"})

    assert response.status_code == 503
    data = response.json()
    assert data["code"] == "LLM_ERROR"
    assert data["error"] == "LLM request failed"
