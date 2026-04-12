"""Tests for portfolio trade execution service."""

import pytest
from fastapi import HTTPException

from app.db.init import init_db
from app.portfolio import db
from app.portfolio.service import execute_trade


@pytest.fixture(autouse=True)
def use_temp_db(tmp_path, monkeypatch):
    db_file = tmp_path / "test.db"
    monkeypatch.setattr("app.db.config.DB_PATH", db_file)
    return db_file


@pytest.fixture
async def conn(use_temp_db):
    """Initialize DB and yield a connection."""
    await init_db()
    from app.db.connection import get_db

    async with get_db() as conn:
        yield conn


async def test_buy_new_position(conn):
    result = await execute_trade(conn, "AAPL", 10, "buy", 150.0)
    assert result["cash_balance"] == 8500.0
    assert len(result["positions"]) == 1
    assert result["positions"][0]["ticker"] == "AAPL"
    assert result["positions"][0]["quantity"] == 10
    assert result["positions"][0]["avg_cost"] == 150.0


async def test_buy_into_existing_weighted_avg_cost(conn):
    await execute_trade(conn, "AAPL", 10, "buy", 100.0)
    result = await execute_trade(conn, "AAPL", 10, "buy", 200.0)
    pos = result["positions"][0]
    assert pos["quantity"] == 20
    assert pos["avg_cost"] == 150.0  # (10*100 + 10*200) / 20
    assert result["cash_balance"] == 7000.0  # 10000 - 1000 - 2000


async def test_sell_partial(conn):
    await execute_trade(conn, "AAPL", 10, "buy", 150.0)
    result = await execute_trade(conn, "AAPL", 3, "sell", 160.0)
    pos = result["positions"][0]
    assert pos["quantity"] == 7
    assert pos["avg_cost"] == 150.0  # avg_cost unchanged on sell
    assert result["cash_balance"] == 8500.0 + 3 * 160.0  # original cash after buy + sell proceeds


async def test_sell_all_position_deleted(conn):
    await execute_trade(conn, "AAPL", 10, "buy", 150.0)
    result = await execute_trade(conn, "AAPL", 10, "sell", 160.0)
    assert result["positions"] == []
    assert result["cash_balance"] == 8500.0 + 10 * 160.0


async def test_insufficient_cash(conn):
    with pytest.raises(HTTPException) as exc_info:
        await execute_trade(conn, "AAPL", 1000, "buy", 150.0)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "INSUFFICIENT_CASH"
    # Verify no state changed
    balance = await db.get_cash_balance(conn)
    assert balance == 10000.0
    positions = await db.get_positions(conn)
    assert positions == []


async def test_insufficient_shares(conn):
    await execute_trade(conn, "AAPL", 10, "buy", 150.0)
    with pytest.raises(HTTPException) as exc_info:
        await execute_trade(conn, "AAPL", 15, "sell", 160.0)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "INSUFFICIENT_SHARES"
    # Position unchanged
    positions = await db.get_positions(conn)
    assert positions[0]["quantity"] == 10


async def test_sell_ticker_not_owned(conn):
    with pytest.raises(HTTPException) as exc_info:
        await execute_trade(conn, "AAPL", 5, "sell", 150.0)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "INSUFFICIENT_SHARES"


async def test_trade_records_snapshot(conn):
    await execute_trade(conn, "AAPL", 10, "buy", 150.0)
    snapshots = await db.get_snapshots(conn)
    assert len(snapshots) == 1
    assert snapshots[0]["total_value"] > 0


async def test_trade_inserts_trade_row(conn):
    await execute_trade(conn, "AAPL", 10, "buy", 150.0)
    cursor = await conn.execute("SELECT ticker, side, quantity, price FROM trades")
    rows = await cursor.fetchall()
    assert len(rows) == 1
    assert (rows[0][0], rows[0][1], rows[0][2], rows[0][3]) == ("AAPL", "buy", 10, 150.0)


async def test_snapshot_uses_live_prices_for_all_positions(conn):
    """Snapshot total_value should use live prices, not avg_cost, for non-traded tickers."""
    prices = {"AAPL": 150.0, "GOOGL": 200.0}
    await execute_trade(conn, "AAPL", 10, "buy", 150.0, get_price=prices.get)
    # AAPL position: 10 shares @ 150. Cash: 8500
    # Now buy GOOGL — AAPL price has risen to 180
    prices["AAPL"] = 180.0
    await execute_trade(conn, "GOOGL", 5, "buy", 200.0, get_price=prices.get)
    # Cash: 8500 - 1000 = 7500
    # AAPL: 10 * 180 = 1800 (live), GOOGL: 5 * 200 = 1000
    # Total: 7500 + 1800 + 1000 = 10300
    snapshots = await db.get_snapshots(conn)
    assert len(snapshots) == 2
    assert snapshots[1]["total_value"] == 10300.0
