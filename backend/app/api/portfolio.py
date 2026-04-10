"""Portfolio management endpoints."""

import asyncio
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.db import get_db
from app.market import PriceCache
from app.services import execute_trade_service
from app.services.trade_service import TradeExecutionError

router = APIRouter(tags=["portfolio"])

# Request/Response models
class TradeRequest(BaseModel):
    ticker: str
    quantity: float
    side: str  # "buy" or "sell"


class PositionResponse(BaseModel):
    ticker: str
    quantity: float
    avg_cost: float
    current_price: float
    unrealized_pnl: float
    pnl_percent: float


class PortfolioResponse(BaseModel):
    cash_balance: float
    positions: list[PositionResponse]
    total_value: float


class HistoryEntry(BaseModel):
    total_value: float
    recorded_at: str


@router.get("/portfolio", response_model=PortfolioResponse)
async def get_portfolio(request: Request) -> PortfolioResponse:
    """Get current portfolio state: cash, positions, total value."""
    price_cache: PriceCache = request.app.state.price_cache

    async with get_db() as db:
        # Get cash balance
        user = await db.execute(
            "SELECT cash_balance FROM users_profile WHERE user_id = 'default'"
        )
        user_row = await user.fetchone()
        cash_balance = user_row["cash_balance"] if user_row else 10000.0

        # Get all positions
        positions_query = await db.execute(
            "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id = 'default'"
        )
        positions_rows = await positions_query.fetchall()

        positions = []
        total_position_value = 0.0

        for row in positions_rows:
            ticker = row["ticker"]
            quantity = row["quantity"]
            avg_cost = row["avg_cost"]

            current_price = price_cache.get_price(ticker) or avg_cost
            position_value = quantity * current_price
            unrealized_pnl = position_value - (quantity * avg_cost)
            pnl_percent = (unrealized_pnl / (quantity * avg_cost) * 100) if avg_cost > 0 else 0.0

            positions.append(
                PositionResponse(
                    ticker=ticker,
                    quantity=quantity,
                    avg_cost=avg_cost,
                    current_price=current_price,
                    unrealized_pnl=unrealized_pnl,
                    pnl_percent=pnl_percent,
                )
            )
            total_position_value += position_value

        total_value = cash_balance + total_position_value

        return PortfolioResponse(
            cash_balance=cash_balance,
            positions=positions,
            total_value=total_value,
        )


@router.post("/portfolio/trade")
async def execute_trade(request: Request, trade: TradeRequest):
    """Execute a buy or sell trade.

    Returns updated portfolio. Validates cash for buys, shares for sells.
    """
    price_cache: PriceCache = request.app.state.price_cache

    async with get_db() as db:
        try:
            # Use the service to execute the trade
            await execute_trade_service(
                db,
                price_cache,
                trade.ticker,
                trade.quantity,
                trade.side,
            )
        except TradeExecutionError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Record portfolio snapshot (for P&L chart)
        portfolio = await get_portfolio(request)
        await db.execute(
            "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) "
            "VALUES (?, 'default', ?, ?)",
            (str(uuid.uuid4()), portfolio.total_value, datetime.utcnow().isoformat()),
        )
        await db.commit()

    # Return updated portfolio
    return await get_portfolio(request)


@router.get("/portfolio/history", response_model=list[HistoryEntry])
async def get_portfolio_history(request: Request) -> list[HistoryEntry]:
    """Get portfolio value snapshots over time (for P&L chart)."""
    async with get_db() as db:
        query = await db.execute(
            "SELECT total_value, recorded_at FROM portfolio_snapshots "
            "WHERE user_id = 'default' ORDER BY recorded_at ASC"
        )
        rows = await query.fetchall()
        return [
            HistoryEntry(total_value=row["total_value"], recorded_at=row["recorded_at"])
            for row in rows
        ]


async def start_snapshot_task(price_cache: PriceCache) -> None:
    """Background task that records portfolio snapshots every 30 seconds."""
    import uuid

    while True:
        try:
            await asyncio.sleep(30)

            # Compute current portfolio value
            async with get_db() as db:
                # Get cash
                user = await db.execute(
                    "SELECT cash_balance FROM users_profile WHERE user_id = 'default'"
                )
                user_row = await user.fetchone()
                cash = user_row["cash_balance"] if user_row else 10000.0

                # Get position values
                positions_query = await db.execute(
                    "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id = 'default'"
                )
                positions_rows = await positions_query.fetchall()

                position_value = 0.0
                for row in positions_rows:
                    ticker = row["ticker"]
                    quantity = row["quantity"]
                    current_price = price_cache.get_price(ticker)
                    if current_price:
                        position_value += quantity * current_price

                total_value = cash + position_value

                # Insert snapshot
                await db.execute(
                    "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) "
                    "VALUES (?, 'default', ?, ?)",
                    (str(uuid.uuid4()), total_value, datetime.utcnow().isoformat()),
                )
                await db.commit()

        except asyncio.CancelledError:
            break
        except Exception:
            # Log and continue on error
            pass
