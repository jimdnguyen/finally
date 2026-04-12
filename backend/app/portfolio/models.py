"""Pydantic models for the portfolio API."""

from typing import Literal

from pydantic import BaseModel, Field


class TradeRequest(BaseModel):
    ticker: str
    quantity: float = Field(gt=0)
    side: Literal["buy", "sell"]


class PositionResponse(BaseModel):
    ticker: str
    quantity: float
    avg_cost: float
    current_price: float
    unrealized_pnl: float
    pnl_pct: float


class PortfolioResponse(BaseModel):
    cash_balance: float
    positions: list[PositionResponse]
    total_value: float


class PortfolioHistoryPoint(BaseModel):
    recorded_at: str
    total_value: float
