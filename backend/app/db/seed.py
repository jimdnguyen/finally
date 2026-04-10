"""Seed functions to populate default data."""

import uuid
from datetime import datetime, timezone
import aiosqlite


DEFAULT_USER_ID = "default"
DEFAULT_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]


async def seed_database(db: aiosqlite.Connection) -> None:
    """Seed database with default data if empty (idempotent)."""
    # Check if user profile already exists
    cursor = await db.execute(
        "SELECT id FROM users_profile WHERE user_id = ?",
        (DEFAULT_USER_ID,)
    )
    user_exists = await cursor.fetchone()

    if user_exists:
        # Already seeded, skip
        return

    # Create default user
    now = datetime.now(timezone.utc).isoformat()
    user_id = DEFAULT_USER_ID
    await db.execute(
        """
        INSERT INTO users_profile (id, user_id, cash_balance, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, user_id, 10000.0, now)
    )

    # Add default watchlist tickers
    for ticker in DEFAULT_TICKERS:
        ticker_id = str(uuid.uuid4())
        await db.execute(
            """
            INSERT INTO watchlist (id, user_id, ticker, added_at)
            VALUES (?, ?, ?, ?)
            """,
            (ticker_id, DEFAULT_USER_ID, ticker, now)
        )

    await db.commit()
