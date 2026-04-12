"""Watchlist API routes."""

from fastapi import APIRouter, HTTPException

from app.db import get_db
from app.market import MarketDataSource, PriceCache
from app.watchlist.db import add_ticker, get_watchlist_tickers, remove_ticker
from app.watchlist.models import AddTickerRequest, WatchlistItem


def create_watchlist_router(price_cache: PriceCache, market_source: MarketDataSource) -> APIRouter:
    router = APIRouter()

    @router.get("/watchlist", response_model=list[WatchlistItem])
    async def get_watchlist():
        async with get_db() as conn:
            tickers = await get_watchlist_tickers(conn)
        return [WatchlistItem(ticker=t, price=price_cache.get_price(t)) for t in tickers]

    @router.post("/watchlist", response_model=WatchlistItem, status_code=201)
    async def add_to_watchlist(body: AddTickerRequest):
        ticker = body.ticker.upper().strip()
        if not ticker:
            raise HTTPException(
                status_code=422,
                detail={"error": "Ticker is required", "code": "INVALID_TICKER"},
            )
        async with get_db() as conn:
            await add_ticker(conn, ticker)
        await market_source.add_ticker(ticker)
        return WatchlistItem(ticker=ticker, price=price_cache.get_price(ticker))

    @router.delete("/watchlist/{ticker}", status_code=204)
    async def remove_from_watchlist(ticker: str):
        ticker = ticker.upper()
        async with get_db() as conn:
            removed = await remove_ticker(conn, ticker)
        if not removed:
            raise HTTPException(
                status_code=404,
                detail={"error": "Ticker not found", "code": "TICKER_NOT_FOUND"},
            )
        await market_source.remove_ticker(ticker)

    return router
