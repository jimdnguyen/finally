"""FastAPI routes for portfolio endpoints."""

import sqlite3

from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool

from app.dependencies import get_db, get_price_cache
from app.market import PriceCache
from app.portfolio.models import PortfolioHistoryResponse, PortfolioResponse, PositionDetail
from app.portfolio.service import get_portfolio_data


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

    return router
