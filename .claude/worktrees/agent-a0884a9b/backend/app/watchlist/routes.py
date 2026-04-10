"""FastAPI routes for watchlist endpoints."""

import sqlite3

from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool

from app.dependencies import get_db, get_price_cache
from app.market import PriceCache
from app.watchlist.models import WatchlistItemResponse, WatchlistResponse


def create_watchlist_router() -> APIRouter:
    """Create and return the watchlist API router.

    Returns an APIRouter with the GET /api/watchlist endpoint that returns
    all watched tickers with live prices from the PriceCache.
    """
    router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])

    @router.get("", response_model=WatchlistResponse)
    async def get_watchlist(
        db: sqlite3.Connection = Depends(get_db),
        price_cache: PriceCache = Depends(get_price_cache),
    ) -> WatchlistResponse:
        """Get all watched tickers with live market prices.

        Queries the database for all tickers in the user's watchlist,
        fetches current prices from the PriceCache, and returns a list
        of WatchlistItemResponse objects with current and previous prices.

        For tickers not yet in PriceCache (edge case), uses fallback values
        (price=0.0, previous_price=0.0, direction="flat").
        """

        def _get_watchlist():
            cursor = db.cursor()
            # Query all watched tickers for the default user, ordered by add time
            cursor.execute(
                """
                SELECT ticker FROM watchlist
                WHERE user_id='default'
                ORDER BY added_at DESC
            """
            )
            rows = cursor.fetchall()

            watchlist_items = []
            for row in rows:
                ticker = row[0]
                # Fetch live price from cache; use fallback if not found
                price_update = price_cache.get(ticker)
                if price_update:
                    item = WatchlistItemResponse(
                        ticker=ticker,
                        price=price_update.price,
                        previous_price=price_update.previous_price,
                        direction=price_update.direction,
                        change_amount=price_update.price
                        - price_update.previous_price,
                    )
                else:
                    # Fallback for ticker not in cache
                    item = WatchlistItemResponse(
                        ticker=ticker,
                        price=0.0,
                        previous_price=0.0,
                        direction="flat",
                        change_amount=0.0,
                    )
                watchlist_items.append(item)

            return watchlist_items

        items = await run_in_threadpool(_get_watchlist)
        return WatchlistResponse(watchlist=items)

    return router
