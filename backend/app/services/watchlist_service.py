"""Watchlist management service."""

import uuid
from datetime import datetime
import aiosqlite


class WatchlistError(Exception):
    """Error modifying watchlist."""

    pass


async def add_to_watchlist(db: aiosqlite.Connection, ticker: str) -> dict:
    """Add a ticker to the default user's watchlist.

    Returns {success, message, ticker}.
    Raises WatchlistError if already on list.
    """
    ticker = ticker.upper()

    # Check if already exists
    existing = await db.execute(
        "SELECT id FROM watchlist WHERE user_id = 'default' AND ticker = ?",
        (ticker,),
    )
    existing_row = await existing.fetchone()

    if existing_row:
        raise WatchlistError(f"{ticker} is already on your watchlist")

    # Insert
    await db.execute(
        "INSERT INTO watchlist (id, user_id, ticker, added_at) "
        "VALUES (?, 'default', ?, ?)",
        (str(uuid.uuid4()), ticker, datetime.utcnow().isoformat()),
    )
    await db.commit()

    return {
        "success": True,
        "message": f"Added {ticker} to watchlist",
        "ticker": ticker,
    }


async def remove_from_watchlist(db: aiosqlite.Connection, ticker: str) -> dict:
    """Remove a ticker from the default user's watchlist.

    Returns {success, message, ticker}.
    Raises WatchlistError if not found.
    """
    ticker = ticker.upper()

    # Check if exists
    existing = await db.execute(
        "SELECT id FROM watchlist WHERE user_id = 'default' AND ticker = ?",
        (ticker,),
    )
    existing_row = await existing.fetchone()

    if not existing_row:
        raise WatchlistError(f"{ticker} is not on your watchlist")

    # Delete
    await db.execute(
        "DELETE FROM watchlist WHERE user_id = 'default' AND ticker = ?",
        (ticker,),
    )
    await db.commit()

    return {
        "success": True,
        "message": f"Removed {ticker} from watchlist",
        "ticker": ticker,
    }
