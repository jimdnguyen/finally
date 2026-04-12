"""Portfolio snapshot background task — records portfolio value every 30s."""

import asyncio

from app.db.connection import get_db
from app.market import PriceCache
from app.portfolio import db as portfolio_db


async def snapshot_loop(price_cache: PriceCache, interval: float = 30.0) -> None:
    """Record portfolio value every `interval` seconds."""
    try:
        while True:
            await asyncio.sleep(interval)
            async with get_db() as conn:
                cash = await portfolio_db.get_cash_balance(conn)
                positions = await portfolio_db.get_positions(conn)
                total_value = cash + sum(
                    (price_cache.get_price(p["ticker"]) or p["avg_cost"])
                    * p["quantity"]
                    for p in positions
                )
                await portfolio_db.insert_snapshot(conn, total_value)
    except asyncio.CancelledError:
        return
