"""FastAPI entry point for FinAlly trading platform."""

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.db import init_db, get_db
from app.market import PriceCache, create_market_data_source, create_stream_router
from app.api.portfolio import router as portfolio_router, start_snapshot_task
from app.api.watchlist import router as watchlist_router
from app.api.chat import router as chat_router

PROJECT_ROOT = Path(__file__).parent.parent.parent  # finally/

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app startup and shutdown."""
    # Check if already initialized (e.g., by test fixture)
    if not hasattr(app.state, "price_cache") or app.state.price_cache is None:
        # Initialize database
        await init_db()

        # Initialize market data
        price_cache = PriceCache()
        app.state.price_cache = price_cache

        market_source = create_market_data_source(price_cache)
        app.state.market_source = market_source

        # Load initial watchlist and start market data source
        async with get_db() as db:
            rows = await db.execute("SELECT ticker FROM watchlist WHERE user_id='default'")
            tickers = [r["ticker"] for r in await rows.fetchall()]

        if tickers:
            await market_source.start(tickers)
    else:
        # Already initialized by test fixture
        price_cache = app.state.price_cache
        market_source = app.state.market_source

    # Start portfolio snapshot task
    snapshot_task = asyncio.create_task(start_snapshot_task(price_cache))

    yield

    # Cleanup on shutdown
    snapshot_task.cancel()
    try:
        await snapshot_task
    except asyncio.CancelledError:
        pass

    await market_source.stop()


app = FastAPI(title="FinAlly", lifespan=lifespan)

# Add CORS middleware (allow localhost for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


# API routes - must be registered BEFORE static files mount
app.include_router(portfolio_router, prefix="/api")
app.include_router(watchlist_router, prefix="/api")
app.include_router(chat_router, prefix="/api")

# SSE stream router - cache is resolved from app.state at request time
stream_router = create_stream_router()
app.include_router(stream_router)

# Static files (Next.js export) - mount at end if directory exists
static_dir = PROJECT_ROOT / "static"
if static_dir.exists():
    # Serve static files with fallback to index.html for SPA routing
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
