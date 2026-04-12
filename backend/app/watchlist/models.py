"""Pydantic models for the watchlist API."""

from pydantic import BaseModel


class WatchlistItem(BaseModel):
    ticker: str
    price: float | None


class AddTickerRequest(BaseModel):
    ticker: str
