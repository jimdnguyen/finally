"""Watchlist API Pydantic models.

Defines request/response schemas for the watchlist endpoint with live price data.
"""

from pydantic import BaseModel, Field


class WatchlistItemResponse(BaseModel):
    """Single watched ticker with live price data from PriceCache.

    - ticker: The stock symbol (e.g., "AAPL")
    - price: Current price from PriceCache (float)
    - previous_price: Price at last update interval
    - direction: Price movement direction ("up", "down", or "flat")
    - change_amount: Price change in dollars (price - previous_price)
    """

    ticker: str = Field(..., description="Stock ticker symbol")
    price: float = Field(..., description="Current price")
    previous_price: float = Field(..., description="Previous price")
    direction: str = Field(
        ..., description="Price direction: 'up', 'down', or 'flat'"
    )
    change_amount: float = Field(..., description="Price change (price - previous)")


class WatchlistResponse(BaseModel):
    """Response wrapper for watchlist endpoint.

    - watchlist: List of watched tickers with live prices
    """

    watchlist: list[WatchlistItemResponse] = Field(
        ..., description="Array of watched tickers with live prices"
    )
