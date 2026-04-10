"""Pydantic models for LLM structured outputs."""

from pydantic import BaseModel, Field
from typing import Literal


class TradeAction(BaseModel):
    """A trade action to be executed."""

    ticker: str = Field(..., description="Stock ticker symbol (e.g., AAPL)")
    side: Literal["buy", "sell"] = Field(..., description="Buy or sell")
    quantity: float = Field(..., gt=0, description="Number of shares (can be fractional)")


class WatchlistAction(BaseModel):
    """A watchlist modification."""

    ticker: str = Field(..., description="Stock ticker symbol")
    action: Literal["add", "remove"] = Field(
        ..., description="Add or remove from watchlist"
    )


class ChatResponse(BaseModel):
    """Structured response from the LLM chat endpoint."""

    message: str = Field(
        ..., description="Conversational response to the user (max ~500 chars)"
    )
    trades: list[TradeAction] = Field(
        default_factory=list, description="Trades to auto-execute"
    )
    watchlist_changes: list[WatchlistAction] = Field(
        default_factory=list, description="Watchlist modifications to apply"
    )
