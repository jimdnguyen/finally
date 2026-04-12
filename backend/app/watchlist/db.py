"""Async database functions for watchlist operations."""

import uuid
from datetime import datetime, timezone

import aiosqlite


async def get_watchlist_tickers(conn: aiosqlite.Connection) -> list[str]:
    cursor = await conn.execute(
        "SELECT ticker FROM watchlist WHERE user_id = 'default' ORDER BY added_at"
    )
    rows = await cursor.fetchall()
    return [row[0] for row in rows]


async def add_ticker(conn: aiosqlite.Connection, ticker: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    await conn.execute(
        "INSERT OR IGNORE INTO watchlist (id, user_id, ticker, added_at) VALUES (?, 'default', ?, ?)",
        (str(uuid.uuid4()), ticker.upper(), now),
    )
    await conn.commit()


async def remove_ticker(conn: aiosqlite.Connection, ticker: str) -> bool:
    cursor = await conn.execute(
        "DELETE FROM watchlist WHERE user_id = 'default' AND ticker = ?",
        (ticker.upper(),),
    )
    await conn.commit()
    return cursor.rowcount > 0
