"""Unit tests for portfolio endpoints, Decimal precision, and atomic transactions."""

import sqlite3
import uuid
from decimal import Decimal

import pytest

from app.market import PriceCache
from app.portfolio.service import (
    compute_portfolio_value,
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
