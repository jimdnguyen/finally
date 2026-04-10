"""Unit tests for portfolio endpoints, Decimal precision, and atomic transactions."""

import asyncio
import sqlite3
import uuid
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.background.tasks import snapshot_loop
from app.market import PriceCache
from app.portfolio.service import (
    compute_portfolio_value,
    execute_trade,
    get_portfolio_data,
    validate_trade_setup,
)


def test_get_portfolio(test_db: sqlite3.Connection, price_cache: PriceCache) -> None:
    """Test portfolio data retrieval with positions, live prices, and P&L calculation.

    Requirement: PORT-01

    Tests the service layer directly to avoid thread affinity issues with in-memory DBs.
    """
    # Setup: Insert a test position
    cursor = test_db.cursor()
    position_id = str(uuid.uuid4())
    cursor.execute(
        """
        INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
        VALUES (?, 'default', 'AAPL', 10.0, '150.25', datetime('now'))
    """,
        (position_id,),
    )
    test_db.commit()

    # Setup: Mock PriceCache with AAPL price
    price_cache.update("AAPL", 155.50)

    # Call service function
    data = get_portfolio_data(cursor, price_cache)

    # Verify cash balance (default, untouched)
    assert data["cash_balance"] == 10000.0

    # Verify positions
    assert len(data["positions"]) == 1
    position = data["positions"][0]
    assert position["ticker"] == "AAPL"
    assert position["quantity"] == 10.0
    assert position["current_price"] == 155.50

    # Verify unrealized P&L: (155.50 - 150.25) * 10 = 52.50
    assert position["unrealized_pnl"] == pytest.approx(52.50, abs=0.01)

    # Verify total value: 10000 + (155.50 * 10) = 11555.0
    assert data["total_value"] == pytest.approx(11555.0, abs=0.01)


def test_get_portfolio_history(test_db: sqlite3.Connection) -> None:
    """Test retrieval of portfolio snapshots for P&L chart.

    Requirement: PORT-03

    Verifies snapshots are ordered chronologically and values are correct.
    """
    # Setup: Insert 3 portfolio snapshots
    cursor = test_db.cursor()
    snapshots = [
        (str(uuid.uuid4()), "10000.00", "2026-04-09 10:00:00"),
        (str(uuid.uuid4()), "10050.50", "2026-04-09 10:01:00"),
        (str(uuid.uuid4()), "10100.25", "2026-04-09 10:02:00"),
    ]
    for snapshot_id, total_value, recorded_at in snapshots:
        cursor.execute(
            """
            INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at)
            VALUES (?, 'default', ?, ?)
        """,
            (snapshot_id, total_value, recorded_at),
        )
    test_db.commit()

    # Fetch snapshots via query
    cursor.execute(
        """
        SELECT total_value, recorded_at FROM portfolio_snapshots
        WHERE user_id='default' ORDER BY recorded_at ASC
    """
    )
    rows = cursor.fetchall()

    # Verify count
    assert len(rows) == 3

    # Verify values
    assert float(rows[0][0]) == 10000.00
    assert float(rows[1][0]) == 10050.50
    assert float(rows[2][0]) == 10100.25

    # Verify ordering (oldest first)
    assert rows[0][1] == "2026-04-09 10:00:00"
    assert rows[2][1] == "2026-04-09 10:02:00"


def test_trade_atomic_rollback(test_db: sqlite3.Connection) -> None:
    """Test atomic transaction setup with BEGIN IMMEDIATE and rollback.

    Requirement: PORT-04

    Tests the low-level transaction pattern without executing a full trade.
    Verifies BEGIN IMMEDIATE succeeds, SELECT works within transaction, and
    ROLLBACK preserves data.
    """
    # Setup: Get initial cash balance
    cursor = test_db.cursor()
    cursor.execute("SELECT cash_balance FROM users_profile WHERE id='default'")
    initial_balance = cursor.fetchone()[0]

    # Start atomic transaction
    cursor.execute("BEGIN IMMEDIATE")

    # Execute SELECT within transaction
    cursor.execute("SELECT cash_balance FROM users_profile WHERE id='default'")
    row = cursor.fetchone()
    assert row is not None

    # Rollback transaction
    test_db.rollback()

    # Verify data is unchanged after rollback
    cursor.execute("SELECT cash_balance FROM users_profile WHERE id='default'")
    final_balance = cursor.fetchone()[0]
    assert final_balance == initial_balance


def test_decimal_precision(
    test_db: sqlite3.Connection, price_cache: PriceCache
) -> None:
    """Test Decimal precision in portfolio calculations (no float accumulation errors).

    Requirement: DATA-04 (Decimal precision)

    Tests that avg_cost calculations maintain exact Decimal precision through
    multiple operations, avoiding IEEE 754 float errors.
    """
    cursor = test_db.cursor()

    # Setup: Insert first position with avg_cost stored as TEXT
    position_id_1 = str(uuid.uuid4())
    cursor.execute(
        """
        INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
        VALUES (?, 'default', 'AAPL', 10.0, '100.01', datetime('now'))
    """,
        (position_id_1,),
    )
    test_db.commit()

    # Setup: Mock PriceCache
    price_cache.update("AAPL", 150.00)

    # Get portfolio data (triggers Decimal calculations)
    data = get_portfolio_data(cursor, price_cache)

    # Verify calculation with exact Decimal math
    # unrealized_pnl = (150.00 - 100.01) * 10 = 499.90
    expected_pnl = Decimal("499.90")

    assert len(data["positions"]) == 1
    position = data["positions"][0]

    # The service should have calculated this using Decimal
    # (150.00 - 100.01) * 10 = 49.99 * 10 = 499.90
    actual_pnl = Decimal(str(position["unrealized_pnl"]))
    assert actual_pnl == expected_pnl


@pytest.mark.asyncio
async def test_trade_buy_success(test_db: sqlite3.Connection, price_cache: PriceCache) -> None:
    """Test successful buy trade: cash decreases, position is created.

    Requirement: PORT-02

    User buys 10 AAPL at 150.00; cash decreases by 1500, position created.
    """
    # Setup: Update price cache
    price_cache.update("AAPL", 150.00)

    # Action: Execute buy trade
    result = await execute_trade(
        test_db, "AAPL", "buy", Decimal("10"), price_cache
    )

    # Assert: Result success and values
    assert result["success"] is True
    assert result["ticker"] == "AAPL"
    assert result["side"] == "buy"
    assert result["quantity"] == 10.0
    assert result["price"] == 150.0
    assert result["new_balance"] == pytest.approx(8500.0, abs=0.01)
    assert "executed_at" in result

    # Verify DB state: position created
    cursor = test_db.cursor()
    cursor.execute("SELECT quantity, avg_cost FROM positions WHERE ticker='AAPL'")
    row = cursor.fetchone()
    assert row is not None
    assert float(row[0]) == 10.0
    assert float(row[1]) == 150.0

    # Verify DB state: cash decreased
    cursor.execute("SELECT cash_balance FROM users_profile WHERE id='default'")
    balance = cursor.fetchone()[0]
    assert float(balance) == pytest.approx(8500.0, abs=0.01)

    # Verify DB state: trade log recorded
    cursor.execute("SELECT side, quantity, price FROM trades WHERE ticker='AAPL'")
    trade_row = cursor.fetchone()
    assert trade_row is not None
    assert trade_row[0] == "buy"
    assert float(trade_row[1]) == 10.0
    assert float(trade_row[2]) == 150.0


@pytest.mark.asyncio
async def test_trade_buy_insufficient_cash(
    test_db: sqlite3.Connection, price_cache: PriceCache
) -> None:
    """Test buy fails with insufficient cash: HTTP 400, database unchanged.

    Requirement: PORT-02

    User tries to buy 100 AAPL at 150.00 (cost 15000) with cash 10000.
    """
    # Setup: Update price cache
    price_cache.update("AAPL", 150.00)

    # Get initial balance
    cursor = test_db.cursor()
    cursor.execute("SELECT cash_balance FROM users_profile WHERE id='default'")
    initial_balance = float(cursor.fetchone()[0])

    # Action: Attempt buy trade (should fail)
    with pytest.raises(HTTPException) as exc_info:
        await execute_trade(
            test_db, "AAPL", "buy", Decimal("100"), price_cache
        )

    # Assert: HTTPException status 400
    assert exc_info.value.status_code == 400
    assert "Insufficient cash" in exc_info.value.detail

    # Verify DB state unchanged
    cursor.execute("SELECT cash_balance FROM users_profile WHERE id='default'")
    final_balance = float(cursor.fetchone()[0])
    assert final_balance == initial_balance

    # Verify no position created
    cursor.execute("SELECT COUNT(*) as cnt FROM positions WHERE ticker='AAPL'")
    count = cursor.fetchone()[0]
    assert count == 0


@pytest.mark.asyncio
async def test_trade_sell_success(test_db: sqlite3.Connection, price_cache: PriceCache) -> None:
    """Test successful sell trade: position quantity decreases, cash increases.

    Requirement: PORT-02

    Setup: User has 10 AAPL at avg_cost 100.00, cash 8500.00.
    Action: Sell 5 AAPL at current price 160.00.
    Result: Position qty becomes 5, cash becomes 9300.00.
    """
    # Setup: Insert position
    cursor = test_db.cursor()
    position_id = str(uuid.uuid4())
    cursor.execute(
        """
        INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
        VALUES (?, 'default', 'AAPL', 10.0, '100.00', datetime('now'))
    """,
        (position_id,),
    )
    # Update cash to 8500
    cursor.execute(
        "UPDATE users_profile SET cash_balance=? WHERE id='default'",
        ("8500.00",),
    )
    test_db.commit()

    # Setup: Price cache
    price_cache.update("AAPL", 160.00)

    # Action: Sell 5 shares
    result = await execute_trade(
        test_db, "AAPL", "sell", Decimal("5"), price_cache
    )

    # Assert: Result success
    assert result["success"] is True
    assert result["ticker"] == "AAPL"
    assert result["side"] == "sell"
    assert result["quantity"] == 5.0
    assert result["price"] == 160.0
    assert result["new_balance"] == pytest.approx(9300.0, abs=0.01)

    # Verify DB state: position quantity decreased
    cursor.execute("SELECT quantity, avg_cost FROM positions WHERE ticker='AAPL'")
    row = cursor.fetchone()
    assert float(row[0]) == 5.0
    assert float(row[1]) == 100.0  # avg_cost unchanged

    # Verify DB state: cash increased
    cursor.execute("SELECT cash_balance FROM users_profile WHERE id='default'")
    balance = float(cursor.fetchone()[0])
    assert balance == pytest.approx(9300.0, abs=0.01)


@pytest.mark.asyncio
async def test_trade_sell_insufficient_shares(
    test_db: sqlite3.Connection, price_cache: PriceCache
) -> None:
    """Test sell fails with insufficient shares: HTTP 400, database unchanged.

    Requirement: PORT-02

    User tries to sell 20 AAPL when owning only 10.
    """
    # Setup: Insert position
    cursor = test_db.cursor()
    position_id = str(uuid.uuid4())
    cursor.execute(
        """
        INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
        VALUES (?, 'default', 'AAPL', 10.0, '150.00', datetime('now'))
    """,
        (position_id,),
    )
    test_db.commit()

    # Setup: Price cache
    price_cache.update("AAPL", 150.00)

    # Get initial state
    cursor.execute("SELECT quantity FROM positions WHERE ticker='AAPL'")
    initial_qty = float(cursor.fetchone()[0])

    # Action: Attempt to sell more than owned
    with pytest.raises(HTTPException) as exc_info:
        await execute_trade(
            test_db, "AAPL", "sell", Decimal("20"), price_cache
        )

    # Assert: HTTPException status 400
    assert exc_info.value.status_code == 400
    assert "Insufficient shares" in exc_info.value.detail

    # Verify DB state unchanged
    cursor.execute("SELECT quantity FROM positions WHERE ticker='AAPL'")
    final_qty = float(cursor.fetchone()[0])
    assert final_qty == initial_qty


@pytest.mark.asyncio
async def test_sell_to_zero(test_db: sqlite3.Connection, price_cache: PriceCache) -> None:
    """Test sell-to-zero edge case: position row deleted when qty becomes zero.

    Requirement: PORT-02 (Pitfall 5)

    User sells entire position (10 shares); position should be deleted.
    """
    # Setup: Insert position
    cursor = test_db.cursor()
    position_id = str(uuid.uuid4())
    cursor.execute(
        """
        INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
        VALUES (?, 'default', 'AAPL', 10.0, '100.00', datetime('now'))
    """,
        (position_id,),
    )
    test_db.commit()

    # Setup: Price cache
    price_cache.update("AAPL", 150.00)

    # Action: Sell entire position
    result = await execute_trade(
        test_db, "AAPL", "sell", Decimal("10"), price_cache
    )

    # Assert: Result success
    assert result["success"] is True

    # Verify DB state: position row is deleted (not zeroed)
    cursor.execute("SELECT COUNT(*) as cnt FROM positions WHERE ticker='AAPL'")
    count = cursor.fetchone()[0]
    assert count == 0

    # Verify cash increased by (10 * 150.00) = 1500.00
    cursor.execute("SELECT cash_balance FROM users_profile WHERE id='default'")
    balance = float(cursor.fetchone()[0])
    assert balance == pytest.approx(11500.0, abs=0.01)


@pytest.mark.asyncio
async def test_buy_increases_existing_position(
    test_db: sqlite3.Connection, price_cache: PriceCache
) -> None:
    """Test buy on existing position: quantity and avg_cost recalculated.

    Requirement: PORT-02

    Setup: User has 10 AAPL at avg_cost 100.00.
    Action: Buy 10 more at price 110.00.
    Result: qty=20, avg_cost=(10*100 + 10*110)/20 = 105.00.
    """
    # Setup: Insert position
    cursor = test_db.cursor()
    position_id = str(uuid.uuid4())
    cursor.execute(
        """
        INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
        VALUES (?, 'default', 'AAPL', 10.0, '100.00', datetime('now'))
    """,
        (position_id,),
    )
    test_db.commit()

    # Setup: Price cache and initial cash
    price_cache.update("AAPL", 110.00)

    # Action: Buy 10 more AAPL at 110.00
    result = await execute_trade(
        test_db, "AAPL", "buy", Decimal("10"), price_cache
    )

    # Assert: Result success
    assert result["success"] is True
    assert result["quantity"] == 10.0
    assert result["price"] == 110.0

    # Verify DB state: position updated with new qty and avg_cost
    cursor.execute("SELECT quantity, avg_cost FROM positions WHERE ticker='AAPL'")
    row = cursor.fetchone()
    assert float(row[0]) == 20.0
    # avg_cost = (10*100 + 10*110) / 20 = 2100 / 20 = 105.0
    assert float(row[1]) == pytest.approx(105.0, abs=0.01)

    # Verify cash decreased by (10 * 110.00) = 1100.00
    cursor.execute("SELECT cash_balance FROM users_profile WHERE id='default'")
    balance = float(cursor.fetchone()[0])
    assert balance == pytest.approx(8900.0, abs=0.01)


@pytest.mark.asyncio
async def test_snapshot_recorded_post_trade(
    test_db: sqlite3.Connection, price_cache: PriceCache
) -> None:
    """Test portfolio snapshot recorded immediately after trade (same transaction).

    Requirement: DATA-05

    Setup: Price cache with AAPL=150.00.
    Action: Execute a buy trade for 10 AAPL.
    Result: Snapshot recorded with total_value = 10000.0 (unchanged cash + position value).
    """
    # Setup
    price_cache.update("AAPL", 150.0)

    # Action: Execute trade
    result = await execute_trade(test_db, "AAPL", "buy", Decimal("10"), price_cache)

    # Assert trade succeeded
    assert result["success"] is True

    # Assert snapshot was recorded
    cursor = test_db.cursor()
    cursor.execute(
        "SELECT total_value, recorded_at FROM portfolio_snapshots WHERE user_id='default'"
    )
    rows = cursor.fetchall()
    assert len(rows) == 1

    # Verify total_value: (10000 - 1500) + (10 * 150) = 8500 + 1500 = 10000.0
    total_value = float(rows[0][0])
    assert total_value == pytest.approx(10000.0, abs=0.01)

    # Verify recorded_at is recent (ISO format timestamp)
    recorded_at = rows[0][1]
    assert recorded_at is not None


@pytest.mark.asyncio
async def test_snapshot_background_loop(
    test_db: sqlite3.Connection, price_cache: PriceCache
) -> None:
    """Test background task records snapshots at regular intervals.

    Requirement: DATA-05

    Setup: Price cache with tickers.
    Action: Create snapshot_loop task with 1-second interval, run for 3+ seconds.
    Result: At least 2-3 snapshots recorded in database.
    """
    # Setup
    price_cache.update("AAPL", 150.0)

    # Start snapshot loop with 1-second interval for testing
    task = asyncio.create_task(snapshot_loop(test_db, price_cache, interval_seconds=1))

    try:
        # Let task run and record 2-3 snapshots
        await asyncio.sleep(3.5)

        # Query snapshots
        cursor = test_db.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM portfolio_snapshots WHERE user_id='default'"
        )
        count = cursor.fetchone()[0]
        assert count >= 2, f"Expected at least 2 snapshots, got {count}"

        # Verify ordering
        cursor.execute(
            "SELECT total_value FROM portfolio_snapshots WHERE user_id='default' ORDER BY recorded_at"
        )
        rows = cursor.fetchall()
        assert len(rows) >= 2

        # Verify all total_values are reasonable (should be 10000 with no positions)
        for row in rows:
            total_value = float(row[0])
            assert total_value == pytest.approx(10000.0, abs=0.01)

    finally:
        # Cancel the task (test cleanup)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass  # Expected


@pytest.mark.asyncio
async def test_snapshot_loop_cancellation(
    test_db: sqlite3.Connection, price_cache: PriceCache
) -> None:
    """Test background task gracefully handles cancellation without errors.

    Requirement: DATA-05

    Setup: Database initialized, price cache.
    Action: Start snapshot_loop, let it run for 2 seconds, cancel.
    Result: Task cancels cleanly, DB still accessible, snapshots preserved.
    """
    # Setup
    price_cache.update("AAPL", 150.0)

    # Start snapshot loop
    task = asyncio.create_task(snapshot_loop(test_db, price_cache, interval_seconds=1))

    try:
        await asyncio.sleep(2)
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass  # Expected

    # Verify DB is still accessible
    cursor = test_db.cursor()
    cursor.execute("SELECT COUNT(*) FROM portfolio_snapshots WHERE user_id='default'")
    count = cursor.fetchone()[0]
    assert count >= 1, "Snapshots should exist after cancellation"

    # Verify no "database is closed" errors by doing another query
    cursor.execute("SELECT cash_balance FROM users_profile WHERE id='default'")
    row = cursor.fetchone()
    assert row is not None
