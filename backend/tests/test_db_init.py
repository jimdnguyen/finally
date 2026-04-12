"""Tests for database initialization — verifies idempotent init and seeding."""

import aiosqlite
import pytest

from app.db.init import DEFAULT_TICKERS, DEFAULT_USER_ID, init_db


@pytest.fixture(autouse=True)
def use_temp_db(tmp_path, monkeypatch):
    """Redirect DB_PATH to a temp file for isolation."""
    db_file = tmp_path / "test.db"
    monkeypatch.setattr("app.db.init.DB_PATH", db_file)
    monkeypatch.setattr("app.db.connection.DB_PATH", db_file)
    return db_file


async def test_init_creates_all_tables(use_temp_db):
    await init_db()
    async with aiosqlite.connect(use_temp_db) as conn:
        cursor = await conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        tables = {row[0] for row in await cursor.fetchall()}

    expected = {
        "users_profile",
        "watchlist",
        "positions",
        "trades",
        "portfolio_snapshots",
        "chat_messages",
    }
    assert expected.issubset(tables)


async def test_init_seeds_default_user(use_temp_db):
    await init_db()
    async with aiosqlite.connect(use_temp_db) as conn:
        cursor = await conn.execute("SELECT id, cash_balance FROM users_profile")
        rows = await cursor.fetchall()

    assert len(rows) == 1
    assert rows[0][0] == DEFAULT_USER_ID
    assert rows[0][1] == 10000.0


async def test_init_seeds_default_watchlist(use_temp_db):
    await init_db()
    async with aiosqlite.connect(use_temp_db) as conn:
        cursor = await conn.execute("SELECT ticker FROM watchlist ORDER BY added_at")
        rows = await cursor.fetchall()

    tickers = [row[0] for row in rows]
    assert tickers == DEFAULT_TICKERS


async def test_init_is_idempotent(use_temp_db):
    """Calling init_db() twice must not duplicate seed data."""
    await init_db()
    await init_db()

    async with aiosqlite.connect(use_temp_db) as conn:
        cursor = await conn.execute("SELECT COUNT(*) FROM users_profile")
        user_count = (await cursor.fetchone())[0]

        cursor = await conn.execute("SELECT COUNT(*) FROM watchlist")
        watchlist_count = (await cursor.fetchone())[0]

    assert user_count == 1
    assert watchlist_count == len(DEFAULT_TICKERS)
