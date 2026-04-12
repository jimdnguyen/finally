"""Integration tests for portfolio API endpoints."""

from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.db import init_db


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
    """Provide deterministic prices for tests."""
    prices = {"AAPL": 150.0, "GOOGL": 175.0}

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
def temp_db(tmp_path, monkeypatch):
    db_file = tmp_path / "test.db"
    monkeypatch.setattr("app.db.config.DB_PATH", db_file)
    return db_file


@pytest.fixture
async def client(mock_market_source, mock_price_cache, temp_db):
    await init_db()
    from app.main import create_app

    test_app = create_app()
    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as c:
        yield c


async def test_get_portfolio_initial(client):
    response = await client.get("/api/portfolio")
    assert response.status_code == 200
    data = response.json()
    assert data["cash_balance"] == 10000.0
    assert data["positions"] == []
    assert data["total_value"] == 10000.0


async def test_trade_buy_success(client):
    response = await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "buy"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["cash_balance"] == 8500.0
    assert len(data["positions"]) == 1
    pos = data["positions"][0]
    assert pos["ticker"] == "AAPL"
    assert pos["quantity"] == 10
    assert pos["avg_cost"] == 150.0
    assert pos["current_price"] == 150.0
    assert pos["unrealized_pnl"] == 0.0


async def test_trade_buy_insufficient_cash(client):
    response = await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 1000, "side": "buy"},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["code"] == "INSUFFICIENT_CASH"


async def test_trade_sell_success(client):
    await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "buy"},
    )
    response = await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 5, "side": "sell"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["positions"][0]["quantity"] == 5
    assert data["cash_balance"] == 8500.0 + 5 * 150.0


async def test_trade_sell_insufficient_shares(client):
    response = await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 5, "side": "sell"},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["code"] == "INSUFFICIENT_SHARES"


async def test_trade_no_price_available(client):
    response = await client.post(
        "/api/portfolio/trade",
        json={"ticker": "UNKNOWN", "quantity": 1, "side": "buy"},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["code"] == "NO_PRICE"


async def test_trade_invalid_side_rejected(client):
    response = await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 1, "side": "hold"},
    )
    assert response.status_code == 422


async def test_trade_zero_quantity_rejected(client):
    response = await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 0, "side": "buy"},
    )
    assert response.status_code == 422


async def test_get_portfolio_history_empty(client):
    response = await client.get("/api/portfolio/history")
    assert response.status_code == 200
    assert response.json() == []


async def test_get_portfolio_history_after_trade(client):
    await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "buy"},
    )
    response = await client.get("/api/portfolio/history")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert "recorded_at" in data[0]
    assert "total_value" in data[0]


async def test_portfolio_reflects_trade(client):
    """GET /api/portfolio reflects the position created by a trade."""
    await client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 5, "side": "buy"},
    )
    response = await client.get("/api/portfolio")
    data = response.json()
    assert data["cash_balance"] == 9250.0
    assert len(data["positions"]) == 1
    assert data["positions"][0]["ticker"] == "AAPL"
