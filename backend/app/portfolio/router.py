"""Portfolio API routes."""

from fastapi import APIRouter, HTTPException

from app.db import get_db
from app.market import PriceCache
from app.portfolio import db
from app.portfolio.models import (
    PortfolioHistoryPoint,
    PortfolioResponse,
    PositionResponse,
    TradeRequest,
)
from app.portfolio.service import execute_trade


def _build_position_response(pos: dict, price_cache: PriceCache) -> PositionResponse:
    """Build a PositionResponse with live price and P&L."""
    current_price = price_cache.get_price(pos["ticker"]) or pos["avg_cost"]
    unrealized_pnl = (current_price - pos["avg_cost"]) * pos["quantity"]
    pnl_pct = ((current_price - pos["avg_cost"]) / pos["avg_cost"]) * 100 if pos["avg_cost"] else 0.0
    return PositionResponse(
        ticker=pos["ticker"],
        quantity=pos["quantity"],
        avg_cost=pos["avg_cost"],
        current_price=current_price,
        unrealized_pnl=round(unrealized_pnl, 2),
        pnl_pct=round(pnl_pct, 2),
    )


def create_portfolio_router(price_cache: PriceCache) -> APIRouter:
    router = APIRouter()

    @router.get("/portfolio", response_model=PortfolioResponse)
    async def get_portfolio():
        async with get_db() as conn:
            cash = await db.get_cash_balance(conn)
            raw_positions = await db.get_positions(conn)
        positions = [_build_position_response(p, price_cache) for p in raw_positions]
        total_value = cash + sum(p.current_price * p.quantity for p in positions)
        return PortfolioResponse(
            cash_balance=cash, positions=positions, total_value=round(total_value, 2)
        )

    @router.post("/portfolio/trade", response_model=PortfolioResponse)
    async def trade(body: TradeRequest):
        ticker = body.ticker.upper().strip()
        current_price = price_cache.get_price(ticker)
        if current_price is None:
            raise HTTPException(
                status_code=400,
                detail={"error": f"No price available for {ticker}", "code": "NO_PRICE"},
            )
        async with get_db() as conn:
            await execute_trade(conn, ticker, body.quantity, body.side, current_price, get_price=price_cache.get_price)
            cash = await db.get_cash_balance(conn)
            raw_positions = await db.get_positions(conn)
        positions = [_build_position_response(p, price_cache) for p in raw_positions]
        total_value = cash + sum(p.current_price * p.quantity for p in positions)
        return PortfolioResponse(
            cash_balance=cash, positions=positions, total_value=round(total_value, 2)
        )

    @router.get("/portfolio/history", response_model=list[PortfolioHistoryPoint])
    async def get_history():
        async with get_db() as conn:
            snapshots = await db.get_snapshots(conn)
        return [PortfolioHistoryPoint(**s) for s in snapshots]

    return router
