"""Async database functions for portfolio operations."""

import uuid
from datetime import datetime, timezone

import aiosqlite


async def get_cash_balance(conn: aiosqlite.Connection) -> float:
    cursor = await conn.execute(
        "SELECT cash_balance FROM users_profile WHERE id = 'default'"
    )
    row = await cursor.fetchone()
    return row[0]


async def update_cash_balance(conn: aiosqlite.Connection, new_balance: float) -> None:
    await conn.execute(
        "UPDATE users_profile SET cash_balance = ? WHERE id = 'default'",
        (new_balance,),
    )
    await conn.commit()


async def get_positions(conn: aiosqlite.Connection) -> list[dict]:
    cursor = await conn.execute(
        "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id = 'default'"
    )
    rows = await cursor.fetchall()
    return [{"ticker": r[0], "quantity": r[1], "avg_cost": r[2]} for r in rows]


async def upsert_position(
    conn: aiosqlite.Connection, ticker: str, quantity: float, avg_cost: float
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    await conn.execute(
        """INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
           VALUES (?, 'default', ?, ?, ?, ?)
           ON CONFLICT(user_id, ticker)
           DO UPDATE SET quantity = ?, avg_cost = ?, updated_at = ?""",
        (str(uuid.uuid4()), ticker, quantity, avg_cost, now, quantity, avg_cost, now),
    )
    await conn.commit()


async def delete_position(conn: aiosqlite.Connection, ticker: str) -> None:
    await conn.execute(
        "DELETE FROM positions WHERE user_id = 'default' AND ticker = ?",
        (ticker,),
    )
    await conn.commit()


async def insert_trade(
    conn: aiosqlite.Connection, ticker: str, side: str, quantity: float, price: float
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    await conn.execute(
        "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) VALUES (?, 'default', ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), ticker, side, quantity, price, now),
    )
    await conn.commit()


async def insert_snapshot(conn: aiosqlite.Connection, total_value: float) -> None:
    now = datetime.now(timezone.utc).isoformat()
    await conn.execute(
        "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) VALUES (?, 'default', ?, ?)",
        (str(uuid.uuid4()), total_value, now),
    )
    await conn.commit()


async def get_snapshots(conn: aiosqlite.Connection) -> list[dict]:
    cursor = await conn.execute(
        "SELECT recorded_at, total_value FROM portfolio_snapshots WHERE user_id = 'default' ORDER BY recorded_at ASC"
    )
    rows = await cursor.fetchall()
    return [{"recorded_at": r[0], "total_value": r[1]} for r in rows]
