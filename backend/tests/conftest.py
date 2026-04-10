"""Pytest configuration and fixtures."""

import sqlite3
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.db import seed_data
from app.market import PriceCache


@pytest.fixture
def event_loop_policy():
    """Use the default event loop policy for all async tests."""
    import asyncio

    return asyncio.DefaultEventLoopPolicy()


@pytest.fixture
def test_db() -> sqlite3.Connection:
    """Create an in-memory SQLite database with full schema and seed data.

    Fresh database per test (function scope). Automatically creates all tables
    and seeds default user + watchlist.
    """
    # Create in-memory database
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row

    # Enable foreign keys and PRAGMA settings
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    conn.commit()

    # Read and execute schema
    schema_path = Path(__file__).parent.parent / "app" / "db" / "schema.sql"
    with open(schema_path) as f:
        schema_sql = f.read()

    cursor.executescript(schema_sql)
    conn.commit()

    # Seed default data
    seed_data(conn)

    yield conn
    conn.close()


@pytest.fixture
def price_cache() -> PriceCache:
    """Create a fresh PriceCache instance for testing."""
    return PriceCache()


@pytest.fixture
def client(test_db: sqlite3.Connection, price_cache: PriceCache) -> TestClient:
    """Create a FastAPI TestClient with test database and price cache.

    Sets up app.state.db and app.state.price_cache for dependency injection.
    """
    app = FastAPI()
    app.state.db = test_db
    app.state.price_cache = price_cache

    return TestClient(app)
