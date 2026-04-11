"""FastAPI dependency injection helpers.

Provides dependency functions for route handlers to access the database
connection and price cache from the application state.
"""

import sqlite3

from fastapi import Request

from app.market import MarketDataSource, PriceCache


async def get_db(request: Request) -> sqlite3.Connection:
    """Get the database connection from app state.

    Used as a FastAPI dependency: Depends(get_db)
    """
    return request.app.state.db


async def get_price_cache(request: Request) -> PriceCache:
    """Get the price cache from app state.

    Used as a FastAPI dependency: Depends(get_price_cache)
    """
    return request.app.state.price_cache


async def get_market_source(request: Request) -> MarketDataSource:
    """Get the market data source from app state.

    Used as a FastAPI dependency: Depends(get_market_source)
    """
    return request.app.state.market_source
