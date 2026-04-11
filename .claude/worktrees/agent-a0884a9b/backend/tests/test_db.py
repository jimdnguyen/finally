"""Database schema, initialization, and seed data tests."""

import sqlite3
import tempfile
from pathlib import Path

import pytest

from app.db import get_connection, init_db, seed_data


def test_init_db_creates_schema() -> None:
    """Test that init_db creates all 6 tables and 5 indexes (DATA-01)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        import os
        db_path = os.path.join(tmpdir, "test.db")
        os.environ["DB_PATH"] = db_path

        # Call init_db to create schema and seed data
        conn = init_db()

        cursor = conn.cursor()

        # Verify all 6 tables exist
        cursor.execute(
            """SELECT name FROM sqlite_master WHERE type='table'
               ORDER BY name"""
        )
        tables = [row[0] for row in cursor.fetchall()]
        expected_tables = [
            "chat_messages",
            "portfolio_snapshots",
            "positions",
            "trades",
            "users_profile",
            "watchlist",
        ]
        assert tables == expected_tables, f"Expected {expected_tables}, got {tables}"

        # Verify all 5 indexes exist
        cursor.execute(
            """SELECT name FROM sqlite_master WHERE type='index'
               AND name LIKE 'idx_%'
               ORDER BY name"""
        )
        indexes = [row[0] for row in cursor.fetchall()]
        expected_indexes = [
            "idx_chat_user",
            "idx_positions_user",
            "idx_snapshots_user",
            "idx_trades_user",
            "idx_watchlist_user",
        ]
        assert indexes == expected_indexes, f"Expected {expected_indexes}, got {indexes}"

        conn.close()


def test_schema_structure(test_db: sqlite3.Connection) -> None:
    """Test that all tables have the correct columns and types (DATA-02)."""
    cursor = test_db.cursor()

    # Test users_profile columns
    cursor.execute("PRAGMA table_info(users_profile)")
    users_profile_cols = {row[1]: row[2] for row in cursor.fetchall()}
    assert set(users_profile_cols.keys()) == {"id", "cash_balance", "created_at"}
    assert users_profile_cols["id"] == "TEXT"
    assert users_profile_cols["cash_balance"] == "REAL"
    assert users_profile_cols["created_at"] == "TEXT"

    # Test watchlist columns
    cursor.execute("PRAGMA table_info(watchlist)")
    watchlist_cols = {row[1]: row[2] for row in cursor.fetchall()}
    assert set(watchlist_cols.keys()) == {"id", "user_id", "ticker", "added_at"}
    assert watchlist_cols["id"] == "TEXT"
    assert watchlist_cols["user_id"] == "TEXT"
    assert watchlist_cols["ticker"] == "TEXT"

    # Test positions columns
    cursor.execute("PRAGMA table_info(positions)")
    positions_cols = {row[1]: row[2] for row in cursor.fetchall()}
    assert set(positions_cols.keys()) == {
        "id",
        "user_id",
        "ticker",
        "quantity",
        "avg_cost",
        "updated_at",
    }
    assert positions_cols["avg_cost"] == "TEXT"  # Monetary value stored as TEXT
    assert positions_cols["quantity"] == "REAL"

    # Test trades columns
    cursor.execute("PRAGMA table_info(trades)")
    trades_cols = {row[1]: row[2] for row in cursor.fetchall()}
    assert set(trades_cols.keys()) == {
        "id",
        "user_id",
        "ticker",
        "side",
        "quantity",
        "price",
        "executed_at",
    }
    assert trades_cols["price"] == "TEXT"  # Monetary value stored as TEXT

    # Test portfolio_snapshots columns
    cursor.execute("PRAGMA table_info(portfolio_snapshots)")
    snapshots_cols = {row[1]: row[2] for row in cursor.fetchall()}
    assert set(snapshots_cols.keys()) == {"id", "user_id", "total_value", "recorded_at"}
    assert snapshots_cols["total_value"] == "TEXT"  # Monetary value stored as TEXT

    # Test chat_messages columns
    cursor.execute("PRAGMA table_info(chat_messages)")
    chat_cols = {row[1]: row[2] for row in cursor.fetchall()}
    assert set(chat_cols.keys()) == {
        "id",
        "user_id",
        "role",
        "content",
        "actions",
        "created_at",
    }
    assert chat_cols["role"] == "TEXT"
    assert chat_cols["content"] == "TEXT"


def test_seed_data(test_db: sqlite3.Connection) -> None:
    """Test that default user and watchlist tickers are seeded (DATA-03)."""
    cursor = test_db.cursor()

    # Verify default user exists with correct cash balance
    cursor.execute(
        """SELECT cash_balance FROM users_profile WHERE id='default'"""
    )
    user = cursor.fetchone()
    assert user is not None, "Default user not found"
    assert user["cash_balance"] == 10000.0, f"Expected 10000.0, got {user['cash_balance']}"

    # Verify exactly 10 watchlist entries for default user
    cursor.execute(
        """SELECT COUNT(*) as cnt FROM watchlist WHERE user_id='default'"""
    )
    count = cursor.fetchone()["cnt"]
    assert count == 10, f"Expected 10 watchlist entries, got {count}"

    # Verify all 10 expected tickers are present
    cursor.execute(
        """SELECT ticker FROM watchlist WHERE user_id='default' ORDER BY ticker"""
    )
    tickers = [row["ticker"] for row in cursor.fetchall()]
    expected_tickers = ["AAPL", "AMZN", "GOOGL", "JPM", "META", "MSFT", "NFLX",
                       "NVDA", "TSLA", "V"]
    assert tickers == expected_tickers, f"Expected {expected_tickers}, got {tickers}"


def test_wal_mode() -> None:
    """Test that WAL mode is enabled on database connection (DATA-04)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        import os
        db_path = os.path.join(tmpdir, "test.db")
        os.environ["DB_PATH"] = db_path

        # Create a fresh connection
        conn = get_connection()
        cursor = conn.cursor()

        # Check PRAGMA journal_mode
        cursor.execute("PRAGMA journal_mode")
        mode = cursor.fetchone()[0]
        assert mode.upper() == "WAL", f"Expected WAL mode, got {mode}"

        conn.close()
