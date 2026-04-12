"""Tests for portfolio database functions."""

import pytest

from app.db.init import init_db
from app.portfolio.db import (
    delete_position,
    get_cash_balance,
    get_positions,
    get_snapshots,
    insert_snapshot,
    insert_trade,
    update_cash_balance,
    upsert_position,
)


@pytest.fixture(autouse=True)
def use_temp_db(tmp_path, monkeypatch):
    db_file = tmp_path / "test.db"
    monkeypatch.setattr("app.db.config.DB_PATH", db_file)
    return db_file


@pytest.fixture
async def db_conn(use_temp_db):
    """Initialize DB and yield a connection."""
    await init_db()
    from app.db.connection import get_db

    async with get_db() as conn:
        yield conn


async def test_get_cash_balance_default(db_conn):
    balance = await get_cash_balance(db_conn)
    assert balance == 10000.0


async def test_update_cash_balance(db_conn):
    await update_cash_balance(db_conn, 8500.0)
    balance = await get_cash_balance(db_conn)
    assert balance == 8500.0


async def test_get_positions_empty(db_conn):
    positions = await get_positions(db_conn)
    assert positions == []


async def test_upsert_position_new(db_conn):
    await upsert_position(db_conn, "AAPL", 10, 150.0)
    positions = await get_positions(db_conn)
    assert len(positions) == 1
    assert positions[0]["ticker"] == "AAPL"
    assert positions[0]["quantity"] == 10
    assert positions[0]["avg_cost"] == 150.0


async def test_upsert_position_update_existing(db_conn):
    await upsert_position(db_conn, "AAPL", 10, 150.0)
    await upsert_position(db_conn, "AAPL", 15, 155.0)
    positions = await get_positions(db_conn)
    assert len(positions) == 1
    assert positions[0]["quantity"] == 15
    assert positions[0]["avg_cost"] == 155.0


async def test_delete_position(db_conn):
    await upsert_position(db_conn, "AAPL", 10, 150.0)
    await delete_position(db_conn, "AAPL")
    positions = await get_positions(db_conn)
    assert positions == []


async def test_insert_trade(db_conn):
    await insert_trade(db_conn, "AAPL", "buy", 10, 150.0)
    cursor = await db_conn.execute("SELECT ticker, side, quantity, price FROM trades")
    rows = await cursor.fetchall()
    assert len(rows) == 1
    assert rows[0][0] == "AAPL"
    assert rows[0][1] == "buy"
    assert rows[0][2] == 10
    assert rows[0][3] == 150.0


async def test_insert_snapshot(db_conn):
    await insert_snapshot(db_conn, 10234.50)
    snapshots = await get_snapshots(db_conn)
    assert len(snapshots) == 1
    assert snapshots[0]["total_value"] == 10234.50


async def test_get_snapshots_ascending_order(db_conn):
    await insert_snapshot(db_conn, 10000.0)
    await insert_snapshot(db_conn, 10234.50)
    snapshots = await get_snapshots(db_conn)
    assert len(snapshots) == 2
    assert snapshots[0]["total_value"] == 10000.0
    assert snapshots[1]["total_value"] == 10234.50
    assert snapshots[0]["recorded_at"] <= snapshots[1]["recorded_at"]
