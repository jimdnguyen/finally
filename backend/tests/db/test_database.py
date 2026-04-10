"""Tests for database initialization, schema, and seeding."""

import pytest
import aiosqlite
from pathlib import Path

from app.db import init_db, get_db
from app.db.seed import DEFAULT_TICKERS, DEFAULT_USER_ID


@pytest.fixture
async def temp_db(tmp_path: Path):
    """Fixture providing a temporary database path."""
    db_path = str(tmp_path / "test.db")
    yield db_path


@pytest.mark.asyncio
async def test_init_db_creates_all_tables(temp_db):
    """Test that init_db creates all required tables."""
    await init_db(temp_db)

    async with aiosqlite.connect(temp_db) as db:
        cursor = await db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        tables = [row[0] for row in await cursor.fetchall()]

    expected_tables = [
        "chat_messages",
        "portfolio_snapshots",
        "positions",
        "trades",
        "users_profile",
        "watchlist",
    ]
    assert sorted(tables) == sorted(expected_tables)


@pytest.mark.asyncio
async def test_seed_default_user(temp_db):
    """Test that seeding creates default user profile."""
    await init_db(temp_db)

    async with aiosqlite.connect(temp_db) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT id, user_id, cash_balance FROM users_profile WHERE user_id = ?",
            (DEFAULT_USER_ID,)
        )
        user = await cursor.fetchone()

    assert user is not None
    assert user["id"] == DEFAULT_USER_ID
    assert user["user_id"] == DEFAULT_USER_ID
    assert user["cash_balance"] == 10000.0


@pytest.mark.asyncio
async def test_seed_default_watchlist(temp_db):
    """Test that seeding creates 10 default watchlist tickers."""
    await init_db(temp_db)

    async with aiosqlite.connect(temp_db) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT ticker FROM watchlist WHERE user_id = ? ORDER BY ticker",
            (DEFAULT_USER_ID,)
        )
        rows = await cursor.fetchall()
        tickers = [row["ticker"] for row in rows]

    assert len(tickers) == 10
    assert sorted(tickers) == sorted(DEFAULT_TICKERS)


@pytest.mark.asyncio
async def test_init_db_idempotent(temp_db):
    """Test that calling init_db twice is safe (no duplicates, no errors)."""
    # First initialization
    await init_db(temp_db)

    async with aiosqlite.connect(temp_db) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT COUNT(*) as cnt FROM users_profile WHERE user_id = ?",
            (DEFAULT_USER_ID,)
        )
        count1 = (await cursor.fetchone())["cnt"]

    # Second initialization
    await init_db(temp_db)

    async with aiosqlite.connect(temp_db) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT COUNT(*) as cnt FROM users_profile WHERE user_id = ?",
            (DEFAULT_USER_ID,)
        )
        count2 = (await cursor.fetchone())["cnt"]

    # Should be exactly 1 user (no duplicates)
    assert count1 == 1
    assert count2 == 1


@pytest.mark.asyncio
async def test_init_db_idempotent_watchlist(temp_db):
    """Test that calling init_db twice doesn't duplicate watchlist entries."""
    # First initialization
    await init_db(temp_db)

    async with aiosqlite.connect(temp_db) as db:
        cursor = await db.execute(
            "SELECT COUNT(*) as cnt FROM watchlist WHERE user_id = ?",
            (DEFAULT_USER_ID,)
        )
        count1 = (await cursor.fetchone())[0]

    # Second initialization
    await init_db(temp_db)

    async with aiosqlite.connect(temp_db) as db:
        cursor = await db.execute(
            "SELECT COUNT(*) as cnt FROM watchlist WHERE user_id = ?",
            (DEFAULT_USER_ID,)
        )
        count2 = (await cursor.fetchone())[0]

    # Should be exactly 10 tickers (no duplicates)
    assert count1 == 10
    assert count2 == 10


@pytest.mark.asyncio
async def test_get_db_context_manager(temp_db):
    """Test that get_db works as an async context manager."""
    await init_db(temp_db)

    async with get_db(temp_db) as db:
        # Should be an aiosqlite.Connection
        assert isinstance(db, aiosqlite.Connection)
        # Should have row_factory set
        assert db.row_factory is aiosqlite.Row

        # Verify we can query
        cursor = await db.execute(
            "SELECT id FROM users_profile WHERE user_id = ?",
            (DEFAULT_USER_ID,)
        )
        user = await cursor.fetchone()
        assert user is not None


@pytest.mark.asyncio
async def test_wal_mode_enabled(temp_db):
    """Test that WAL mode is enabled."""
    await init_db(temp_db)

    async with get_db(temp_db) as db:
        cursor = await db.execute("PRAGMA journal_mode")
        mode = (await cursor.fetchone())[0]
        assert mode.lower() == "wal"
