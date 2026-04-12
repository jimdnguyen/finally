"""FinAlly FastAPI application entry point."""

from contextlib import asynccontextmanager
from pathlib import Path

import aiosqlite
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.db import init_db
from app.db.connection import DB_PATH
from app.health.router import router as health_router
from app.market import PriceCache, create_market_data_source, create_stream_router
from app.watchlist.router import create_watchlist_router

price_cache = PriceCache()
market_source = create_market_data_source(price_cache)

STATIC_DIR = Path(__file__).parent.parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start market data on startup; stop cleanly on shutdown."""
    await init_db()

    async with aiosqlite.connect(DB_PATH) as conn:
        cursor = await conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id = 'default'"
        )
        rows = await cursor.fetchall()
        tickers = [row[0] for row in rows]

    await market_source.start(tickers)
    yield
    await market_source.stop()


def create_app() -> FastAPI:
    app = FastAPI(title="FinAlly", lifespan=lifespan)

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        """Return detail dict directly as response body (spec: {"error":..., "code":...})."""
        if isinstance(exc.detail, dict):
            return JSONResponse(status_code=exc.status_code, content=exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": str(exc.detail), "code": "ERROR"},
        )

    app.include_router(health_router, prefix="/api")
    app.include_router(create_watchlist_router(price_cache, market_source), prefix="/api")
    app.include_router(create_stream_router(price_cache))

    if STATIC_DIR.exists():
        app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

    return app


app = create_app()
