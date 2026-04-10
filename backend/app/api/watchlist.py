"""Watchlist management endpoints."""

import re
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.db import get_db
from app.market import PriceCache
from app.services import add_to_watchlist, remove_from_watchlist
from app.services.watchlist_service import WatchlistError

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


class WatchlistItem(BaseModel):
    ticker: str
    price: float
    previous_price: float
    change_percent: float
    direction: str


class AddTickerRequest(BaseModel):
    ticker: str


@router.get("", response_model=list[WatchlistItem])
async def get_watchlist(request: Request) -> list[WatchlistItem]:
    """Get current watchlist with live prices from the cache."""
    price_cache: PriceCache = request.app.state.price_cache

    async with get_db() as db:
        query = await db.execute(
            "SELECT ticker FROM watchlist WHERE user_id = 'default' ORDER BY added_at ASC"
        )
        rows = await query.fetchall()
        tickers = [row["ticker"] for row in rows]

    result = []
    for ticker in tickers:
        price_update = price_cache.get(ticker)
        if price_update:
            result.append(
                WatchlistItem(
                    ticker=ticker,
                    price=price_update.price,
                    previous_price=price_update.previous_price,
                    change_percent=price_update.change_percent,
                    direction=price_update.direction,
                )
            )

    return result


@router.post("", status_code=201)
async def add_ticker(request: Request, payload: AddTickerRequest):
    """Add a ticker to the watchlist.

    Validates: uppercase letters only (1-5 chars). Returns 409 if duplicate.
    """
    ticker = payload.ticker.upper()

    # Validate ticker format: 1-5 uppercase letters/digits
    if not re.match(r"^[A-Z0-9]{1,5}$", ticker):
        raise HTTPException(
            status_code=400,
            detail="Ticker must be 1-5 uppercase letters or digits",
        )

    market_source = request.app.state.market_source

    async with get_db() as db:
        try:
            result = await add_to_watchlist(db, ticker)
        except WatchlistError as e:
            raise HTTPException(status_code=409, detail=str(e))

    # Tell market source to track this ticker
    await market_source.add_ticker(ticker)

    return result


@router.delete("/{ticker}")
async def remove_ticker(request: Request, ticker: str):
    """Remove a ticker from the watchlist.

    Returns 404 if not found.
    """
    ticker = ticker.upper()
    market_source = request.app.state.market_source

    async with get_db() as db:
        try:
            result = await remove_from_watchlist(db, ticker)
        except WatchlistError as e:
            raise HTTPException(status_code=404, detail=str(e))

    # Tell market source to stop tracking
    await market_source.remove_ticker(ticker)

    return result
