"""Pytest configuration and fixtures."""

import asyncio
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient

from app.db import init_db, get_db
from app.market import PriceCache, create_market_data_source
from app.main import app as fastapi_app
import app.db.database as db_module


@pytest.fixture
def event_loop_policy():
    """Use the default event loop policy for all async tests."""
    return asyncio.DefaultEventLoopPolicy()


@pytest.fixture
def temp_db():
    """Create a fresh temporary database for each test."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        yield str(db_path)
        # Cleanup happens automatically with TemporaryDirectory context exit


@pytest_asyncio.fixture
async def initialized_db(temp_db):
    """Initialize a fresh test database with schema and seed data for each test."""
    await init_db(temp_db)
    yield temp_db
    # Database is cleaned up automatically when temp_db context exits


@pytest.fixture
def mock_price_cache():
    """Create a mock price cache with test data."""
    cache = PriceCache()
    # Pre-populate with default tickers
    tickers = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]
    for ticker in tickers:
        cache.update(ticker, 100.0)  # Start all at $100
    return cache


@pytest.fixture
def client(temp_db, initialized_db, monkeypatch):
    """Create a test client with fresh test database for each test."""
    # Create fresh mock cache for this test
    mock_cache = PriceCache()
    tickers = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]
    for ticker in tickers:
        mock_cache.update(ticker, 100.0)  # Start all at $100

    # Set up app state with test database and mock market source
    fastapi_app.state.price_cache = mock_cache
    market_source = create_market_data_source(mock_cache)
    fastapi_app.state.market_source = market_source

    # Monkeypatch get_db to use the test database path
    original_get_db = db_module.get_db

    def test_get_db(db_path: str | None = None):
        """Use test database path if no override is provided."""
        return original_get_db(temp_db if db_path is None else db_path)

    # Patch get_db in all modules that import it
    monkeypatch.setattr(db_module, 'get_db', test_get_db)

    import app.api.portfolio as portfolio_module
    import app.api.watchlist as watchlist_module
    import app.api.chat as chat_module

    monkeypatch.setattr(portfolio_module, 'get_db', test_get_db)
    monkeypatch.setattr(watchlist_module, 'get_db', test_get_db)
    monkeypatch.setattr(chat_module, 'get_db', test_get_db)

    # TestClient will run lifespan events
    with TestClient(fastapi_app) as test_client:
        yield test_client


@pytest_asyncio.fixture
async def db_with_data(initialized_db):
    """Provide a database connection with seed data."""
    async with get_db(initialized_db) as db:
        yield db


@pytest_asyncio.fixture
async def db_empty_user(temp_db):
    """Provide a database with schema but no user or watchlist."""
    await init_db(temp_db)
    # Clear seed data
    async with get_db(temp_db) as db:
        await db.execute("DELETE FROM watchlist")
        await db.execute("DELETE FROM positions")
        await db.execute("DELETE FROM users_profile")
        await db.commit()

    # Yield connection without data
    async with get_db(temp_db) as db:
        yield db


@pytest.fixture
def price_cache():
    """Create a price cache with test data."""
    cache = PriceCache()
    # Pre-populate with default tickers
    tickers = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]
    for ticker in tickers:
        cache.update(ticker, 100.0)  # Start all at $100
    return cache
