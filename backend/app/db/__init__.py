"""Database initialization module.

Provides connection management, lazy database initialization, and seed data
population for the FinAlly SQLite database.
"""

import os
import sqlite3
import uuid
from pathlib import Path


def get_connection() -> sqlite3.Connection:
    """Open a connection to the SQLite database.

    - Opens the database file at DB_PATH (default: db/finally.db)
    - Enables WAL mode for concurrent read/write performance
    - Enables foreign key constraints
    - Sets row_factory for column-by-name access
    - Returns the connection object
    """
    db_path = os.environ.get("DB_PATH", "db/finally.db")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row

    # Enable WAL mode for better concurrent access
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    conn.commit()

    return conn


def seed_data(conn: sqlite3.Connection) -> None:
    """Populate default data in the database.

    - Creates default user profile (id='default', cash_balance=10000.0)
    - Seeds 10 default watchlist tickers for the default user
    - Idempotent: does not fail if data already exists
    """
    cursor = conn.cursor()

    # Check if default user exists
    cursor.execute("SELECT id FROM users_profile WHERE id='default'")
    if not cursor.fetchone():
        cursor.execute(
            """INSERT INTO users_profile (id, cash_balance, created_at)
               VALUES ('default', 10000.0, datetime('now'))"""
        )

    # Check if watchlist is empty for default user
    cursor.execute(
        "SELECT COUNT(*) as cnt FROM watchlist WHERE user_id='default'"
    )
    count = cursor.fetchone()["cnt"]

    if count == 0:
        # Seed 10 default tickers
        tickers = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA",
                   "NVDA", "META", "JPM", "V", "NFLX"]
        for ticker in tickers:
            cursor.execute(
                """INSERT INTO watchlist (id, user_id, ticker, added_at)
                   VALUES (?, 'default', ?, datetime('now'))""",
                (str(uuid.uuid4()), ticker)
            )

    conn.commit()


def init_db() -> sqlite3.Connection:
    """Initialize the database on first startup.

    - Calls get_connection() to open/create the database file
    - Reads schema.sql from the same directory
    - Executes the schema via executescript()
    - Calls seed_data() to populate defaults
    - Returns the connection
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Read and execute schema
    schema_path = Path(__file__).parent / "schema.sql"
    with open(schema_path) as f:
        schema_sql = f.read()

    cursor.executescript(schema_sql)
    conn.commit()

    # Seed default data
    seed_data(conn)

    return conn


__all__ = ["get_connection", "init_db", "seed_data"]
