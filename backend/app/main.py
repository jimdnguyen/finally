"""FinAlly FastAPI application entry point.

Wires all routers, manages application lifespan (DB init, market data source),
and exposes the ASGI app for uvicorn.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI

from app.background.tasks import snapshot_loop
from app.chat import create_chat_router
from app.db import init_db
from app.health import create_health_router
from app.market import PriceCache, create_market_data_source, create_stream_router
from app.portfolio import create_portfolio_router
from app.watchlist import create_watchlist_router

load_dotenv()

logger = logging.getLogger(__name__)

# Price cache created at module level so create_stream_router can capture it in its closure.
# The lifespan also stores it on app.state for DI-based route handlers.
_price_cache = PriceCache()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown.

    Startup: initializes SQLite DB, starts market data source with default tickers,
    and spawns portfolio snapshot background task.
    Shutdown: cancels snapshot task, stops market data source, and closes DB.
    """
    db = init_db()
    app.state.db = db
    app.state.price_cache = _price_cache
    logger.info("Database initialized")

    source = create_market_data_source(_price_cache)
    app.state.market_source = source

    tickers = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]
    await source.start(tickers)
    logger.info("Market data source started with %d tickers", len(tickers))

    # Spawn background task for portfolio snapshots
    snapshot_task = asyncio.create_task(
        snapshot_loop(db, _price_cache, interval_seconds=30),
        name="portfolio-snapshot-loop"
    )
    app.state.snapshot_task = snapshot_task
    logger.info("Portfolio snapshot loop started (interval: 30s)")

    yield

    logger.info("Cancelling portfolio snapshot loop...")
    snapshot_task.cancel()
    try:
        await snapshot_task
    except asyncio.CancelledError:
        pass  # Expected; snapshot_loop re-raises after logging

    await source.stop()
    db.close()
    logger.info("Application shutdown complete")


app = FastAPI(title="FinAlly", lifespan=lifespan)

# Stream router has its own /api/stream prefix baked in
app.include_router(create_stream_router(_price_cache))

# Portfolio, watchlist, and chat routers have their own /api/* prefixes
app.include_router(create_portfolio_router())
app.include_router(create_watchlist_router())
app.include_router(create_chat_router())

# Health router has prefix=/health; mount under /api to produce /api/health
app.include_router(create_health_router(), prefix="/api")
