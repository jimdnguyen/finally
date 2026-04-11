"""Portfolio snapshot background task.

Records portfolio value at regular intervals (default 30 seconds) to enable
P&L charting over time. Handles graceful cancellation without database errors.
"""

import asyncio
import logging
import sqlite3
import uuid

from fastapi.concurrency import run_in_threadpool

from app.market import PriceCache
from app.portfolio.service import compute_portfolio_value

logger = logging.getLogger(__name__)


async def snapshot_loop(
    db: sqlite3.Connection,
    price_cache: PriceCache,
    interval_seconds: int = 30,
) -> None:
    """Record portfolio snapshots every N seconds (default 30).

    Runs as a background task spawned in the FastAPI lifespan.
    Gracefully handles cancellation via asyncio.CancelledError.

    Args:
        db: SQLite database connection
        price_cache: PriceCache instance for live prices
        interval_seconds: Interval between snapshots in seconds (default 30)

    The loop sleeps first, then records. This avoids recording immediately
    at startup while allowing lifespan to wait for first snapshot if needed.
    """

    async def _record_snapshot_sync() -> float:
        """Record current portfolio value to database.

        Returns:
            float: Total portfolio value recorded
        """

        def _sync() -> float:
            """Synchronous database recording."""
            cursor = db.cursor()
            # Compute total portfolio value
            total_value = compute_portfolio_value(cursor, price_cache)
            # Insert snapshot
            cursor.execute(
                """INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at)
                   VALUES (?, 'default', ?, datetime('now'))""",
                (str(uuid.uuid4()), str(total_value)),
            )
            db.commit()
            return float(total_value)

        return await run_in_threadpool(_sync)

    try:
        while True:
            await asyncio.sleep(interval_seconds)
            total_value = await _record_snapshot_sync()
            logger.debug(f"Portfolio snapshot recorded: ${total_value:.2f}")
    except asyncio.CancelledError:
        logger.info("Portfolio snapshot loop cancelled (app shutting down)")
        raise
