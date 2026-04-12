"""Portfolio trade execution logic."""

from typing import Callable

import aiosqlite
from fastapi import HTTPException

from . import db


async def execute_trade(
    conn: aiosqlite.Connection,
    ticker: str,
    quantity: float,
    side: str,
    current_price: float,
    get_price: Callable[[str], float | None] | None = None,
) -> dict:
    """Execute a buy or sell trade and return updated portfolio."""
    if side == "buy":
        await _execute_buy(conn, ticker, quantity, current_price)
    else:
        await _execute_sell(conn, ticker, quantity, current_price)

    await db.insert_trade(conn, ticker, side, quantity, current_price)

    # Record snapshot inline (Story 2.1 requirement)
    cash = await db.get_cash_balance(conn)
    positions = await db.get_positions(conn)
    total_value = cash + sum(
        _resolve_price(p, ticker, current_price, get_price) * p["quantity"]
        for p in positions
    )
    await db.insert_snapshot(conn, total_value)

    return {"cash_balance": cash, "positions": positions, "total_value": total_value}


def _resolve_price(
    pos: dict,
    traded_ticker: str,
    trade_price: float,
    get_price: Callable[[str], float | None] | None,
) -> float:
    """Return the best available live price for a position."""
    if pos["ticker"] == traded_ticker:
        return trade_price
    if get_price:
        live = get_price(pos["ticker"])
        if live is not None:
            return live
    return pos["avg_cost"]


async def _execute_buy(
    conn: aiosqlite.Connection, ticker: str, quantity: float, price: float
) -> None:
    cost = quantity * price
    cash = await db.get_cash_balance(conn)

    if cash < cost:
        raise HTTPException(
            status_code=400,
            detail={"error": "Insufficient cash", "code": "INSUFFICIENT_CASH"},
        )

    # Compute weighted average cost if position exists
    positions = await db.get_positions(conn)
    existing = next((p for p in positions if p["ticker"] == ticker), None)

    if existing:
        new_qty = existing["quantity"] + quantity
        new_avg_cost = (
            (existing["quantity"] * existing["avg_cost"]) + (quantity * price)
        ) / new_qty
        await db.upsert_position(conn, ticker, new_qty, new_avg_cost)
    else:
        await db.upsert_position(conn, ticker, quantity, price)

    await db.update_cash_balance(conn, cash - cost)


async def _execute_sell(
    conn: aiosqlite.Connection, ticker: str, quantity: float, price: float
) -> None:
    positions = await db.get_positions(conn)
    existing = next((p for p in positions if p["ticker"] == ticker), None)

    if not existing or existing["quantity"] < quantity:
        raise HTTPException(
            status_code=400,
            detail={"error": "Insufficient shares", "code": "INSUFFICIENT_SHARES"},
        )

    new_qty = existing["quantity"] - quantity
    if new_qty == 0:
        await db.delete_position(conn, ticker)
    else:
        await db.upsert_position(conn, ticker, new_qty, existing["avg_cost"])

    cash = await db.get_cash_balance(conn)
    await db.update_cash_balance(conn, cash + quantity * price)
