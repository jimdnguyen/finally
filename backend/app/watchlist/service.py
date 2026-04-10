"""Watchlist service layer: add and remove tickers from user watchlist.

Provides synchronous functions for watchlist CRUD operations used by both
API routes and LLM auto-execution (chat service).
"""

import sqlite3
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException


def add_watchlist_ticker(db: sqlite3.Connection, ticker: str) -> dict:
    """Add a ticker to the watchlist.

    Normalizes ticker to uppercase and inserts into the watchlist table.
    Raises HTTPException if the ticker is already in the watchlist (UNIQUE constraint).

    Args:
        db: SQLite connection
        ticker: Ticker symbol (will be normalized to uppercase)

    Returns:
        dict with keys:
            - "success": True
            - "ticker": Normalized ticker
            - "action": "added"

    Raises:
        HTTPException: 400 if ticker is invalid format or already in watchlist
    """
    # Normalize ticker
    ticker = ticker.upper().strip()

    # Validate format: 1-5 alphanumeric characters (same as trade validation)
    if not ticker or len(ticker) > 5 or not ticker.isalnum():
        raise HTTPException(
            status_code=400,
            detail=f"Invalid ticker format: {ticker}. Must be 1-5 alphanumeric characters.",
        )

    try:
        cursor = db.cursor()
        ticker_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        cursor.execute(
            """
            INSERT INTO watchlist (id, user_id, ticker, added_at)
            VALUES (?, ?, ?, ?)
        """,
            (ticker_id, "default", ticker, now),
        )
        db.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=400,
            detail=f"Ticker '{ticker}' is already in your watchlist.",
        )

    return {"success": True, "ticker": ticker, "action": "added"}


def remove_watchlist_ticker(db: sqlite3.Connection, ticker: str) -> dict:
    """Remove a ticker from the watchlist.

    Normalizes ticker to uppercase and deletes from the watchlist table.
    Raises HTTPException if the ticker is not in the watchlist.

    Args:
        db: SQLite connection
        ticker: Ticker symbol (will be normalized to uppercase)

    Returns:
        dict with keys:
            - "success": True
            - "ticker": Normalized ticker
            - "action": "removed"

    Raises:
        HTTPException: 400 if ticker not found in watchlist
    """
    # Normalize ticker
    ticker = ticker.upper().strip()

    cursor = db.cursor()
    cursor.execute(
        """
        DELETE FROM watchlist WHERE user_id='default' AND ticker=?
    """,
        (ticker,),
    )
    db.commit()

    if cursor.rowcount == 0:
        raise HTTPException(
            status_code=400,
            detail=f"Ticker '{ticker}' is not in your watchlist.",
        )

    return {"success": True, "ticker": ticker, "action": "removed"}
