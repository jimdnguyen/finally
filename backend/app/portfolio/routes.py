"""FastAPI routes for portfolio endpoints."""

import sqlite3
from decimal import Decimal

from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool

from app.dependencies import get_db, get_price_cache
from app.market import PriceCache
from app.portfolio.models import (
    PortfolioHistoryResponse,
    PortfolioResponse,
    PositionDetail,
    TradeRequest,
    TradeResponse,
)
from app.portfolio.service import execute_trade, get_portfolio_data


def create_portfolio_router() -> APIRouter:
    """Create and return the portfolio API router.

    Returns an APIRouter with two endpoints:
        - GET /api/portfolio: Current positions, cash balance, total value, P&L
        - GET /api/portfolio/history: Historical portfolio snapshots for P&L chart
    """
    router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

    @router.get("", response_model=PortfolioResponse)
    async def get_portfolio(
        db: sqlite3.Connection = Depends(get_db),
        cache: PriceCache = Depends(get_price_cache),
    ) -> PortfolioResponse:
        """Get current portfolio state: positions, cash balance, total value, unrealized P&L.

        Wraps synchronous database access with run_in_threadpool to avoid blocking
        the event loop. Returns live prices from the price cache.
        """

        def _get_state():
            cursor = db.cursor()
            data = get_portfolio_data(cursor, cache)
            return data

        state = await run_in_threadpool(_get_state)
        return PortfolioResponse(
            cash_balance=state["cash_balance"],
            positions=[PositionDetail(**p) for p in state["positions"]],
            total_value=state["total_value"],
        )

    @router.get("/history", response_model=PortfolioHistoryResponse)
    async def get_portfolio_history(
        db: sqlite3.Connection = Depends(get_db),
    ) -> PortfolioHistoryResponse:
        """Get portfolio value history for P&L chart.

        Returns all portfolio snapshots ordered by timestamp (oldest first, newest last).
        Snapshots are recorded every 30 seconds by background task and after each trade.
        """

        def _get_history():
            cursor = db.cursor()
            cursor.execute(
                """
                SELECT total_value, recorded_at FROM portfolio_snapshots
                WHERE user_id='default' ORDER BY recorded_at ASC
            """
            )
            rows = cursor.fetchall()
            snapshots = [
                {"total_value": float(row[0]), "recorded_at": row[1]} for row in rows
            ]
            return snapshots

        snapshots = await run_in_threadpool(_get_history)
        return PortfolioHistoryResponse(snapshots=snapshots)

    @router.post("/trade", response_model=TradeResponse)
    async def trade(
        request: TradeRequest,
        db: sqlite3.Connection = Depends(get_db),
        cache: PriceCache = Depends(get_price_cache),
    ) -> TradeResponse:
        """Execute a market buy or sell order.

        Validates ticker, side, and quantity via Pydantic and service layer.
        Executes atomically via BEGIN IMMEDIATE transaction.
        Records trade log entry and portfolio snapshot on success.

        Args:
            request: TradeRequest with ticker, side, quantity
            db: SQLite database connection (injected)
            cache: PriceCache with live prices (injected)

        Returns:
            TradeResponse with execution details (price, new balance, timestamp)

        Raises:
            HTTPException 400: Invalid request or trade validation failure
            HTTPException 500: Database or system error
        """
        # Extract and normalize request data
        ticker_normalized = request.ticker.upper()
        side_normalized = request.side.lower()
        quantity_decimal = Decimal(str(request.quantity))

        # Call execute_trade service function
        result = await execute_trade(
            db,
            ticker_normalized,
            side_normalized,
            quantity_decimal,
            cache,
        )

        # Return TradeResponse (FastAPI will serialize to JSON automatically)
        return TradeResponse(**result)

    return router
