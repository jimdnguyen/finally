"""Pydantic models for portfolio API request/response schemas."""

from pydantic import BaseModel, Field


class PositionDetail(BaseModel):
    """Represents a single holding in the portfolio.

    Includes current position value, average cost, unrealized P&L, and daily change.
    All monetary values are floats at the JSON boundary; Decimal conversion happens
    in the service layer.
    """

    ticker: str = Field(..., description="Ticker symbol (uppercase, 1-5 chars)")
    quantity: float = Field(..., description="Number of shares held")
    avg_cost: float = Field(..., description="Average cost per share")
    current_price: float = Field(..., description="Latest price from cache")
    unrealized_pnl: float = Field(
        ...,
        description="Unrealized P&L: (current_price - avg_cost) * quantity",
    )
    change_percent: float = Field(
        ..., description="Daily % change from PriceCache.change_percent"
    )


class PortfolioResponse(BaseModel):
    """GET /api/portfolio response body.

    Returns current cash balance, all positions with live prices, total portfolio
    value, and unrealized P&L per position. Total P&L is calculated on frontend
    from portfolio_snapshots.
    """

    cash_balance: float = Field(..., description="Available cash balance")
    positions: list[PositionDetail] = Field(
        default_factory=list, description="Current holdings"
    )
    total_value: float = Field(..., description="cash_balance + sum of position values")


class SnapshotRecord(BaseModel):
    """Individual snapshot in portfolio history.

    Used for P&L chart; includes total portfolio value at a point in time.
    """

    total_value: float = Field(..., description="Total portfolio value at timestamp")
    recorded_at: str = Field(..., description="ISO timestamp when snapshot was recorded")


class PortfolioHistoryResponse(BaseModel):
    """GET /api/portfolio/history response body.

    Returns list of portfolio snapshots ordered by timestamp for P&L chart display.
    """

    snapshots: list[SnapshotRecord] = Field(
        default_factory=list, description="Portfolio value over time, ordered by timestamp"
    )
