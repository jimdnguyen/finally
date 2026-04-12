"""Tests for the watchlist API endpoints."""

from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.db import init_db
from app.db.init import DEFAULT_TICKERS


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
def temp_db(tmp_path, monkeypatch):
    db_file = tmp_path / "test.db"
    monkeypatch.setattr("app.db.config.DB_PATH", db_file)
    return db_file


@pytest.fixture
async def client(mock_market_source, temp_db):
    await init_db()

    from app.main import create_app

    test_app = create_app()
    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as c:
        yield c


async def test_get_watchlist_returns_default_tickers(client):
    response = await client.get("/api/watchlist")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == len(DEFAULT_TICKERS)
    tickers = [item["ticker"] for item in data]
    assert set(tickers) == set(DEFAULT_TICKERS)


async def test_get_watchlist_item_shape(client):
    response = await client.get("/api/watchlist")
    item = response.json()[0]
    assert "ticker" in item
    assert "price" in item


async def test_get_watchlist_price_is_null_before_data(client):
    """Price is null when market data hasn't populated cache yet."""
    response = await client.get("/api/watchlist")
    for item in response.json():
        assert item["price"] is None


async def test_post_watchlist_adds_ticker(client):
    response = await client.post("/api/watchlist", json={"ticker": "PYPL"})
    assert response.status_code == 201
    data = response.json()
    assert data["ticker"] == "PYPL"
    assert data["price"] is None

    list_response = await client.get("/api/watchlist")
    tickers = [item["ticker"] for item in list_response.json()]
    assert "PYPL" in tickers


async def test_post_watchlist_normalizes_ticker_to_uppercase(client):
    response = await client.post("/api/watchlist", json={"ticker": "aapl"})
    assert response.status_code == 201
    # AAPL already in DB; INSERT OR IGNORE means no duplicate
    list_response = await client.get("/api/watchlist")
    tickers = [item["ticker"] for item in list_response.json()]
    assert tickers.count("AAPL") == 1


async def test_post_watchlist_idempotent(client):
    """Adding a duplicate ticker is a no-op (INSERT OR IGNORE)."""
    await client.post("/api/watchlist", json={"ticker": "NEW1"})
    await client.post("/api/watchlist", json={"ticker": "NEW1"})
    list_response = await client.get("/api/watchlist")
    tickers = [item["ticker"] for item in list_response.json()]
    assert tickers.count("NEW1") == 1


async def test_delete_watchlist_removes_ticker(client):
    response = await client.delete("/api/watchlist/AAPL")
    assert response.status_code == 204

    list_response = await client.get("/api/watchlist")
    tickers = [item["ticker"] for item in list_response.json()]
    assert "AAPL" not in tickers


async def test_delete_watchlist_returns_404_for_unknown_ticker(client):
    response = await client.delete("/api/watchlist/UNKNOWN")
    assert response.status_code == 404
    data = response.json()
    assert data["code"] == "TICKER_NOT_FOUND"
