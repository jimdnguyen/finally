"""Tests for portfolio Pydantic models."""

import pytest
from pydantic import ValidationError

from app.portfolio.models import (
    PortfolioHistoryPoint,
    PortfolioResponse,
    PositionResponse,
    TradeRequest,
)


class TestTradeRequest:
    def test_valid_buy(self):
        req = TradeRequest(ticker="AAPL", quantity=10, side="buy")
        assert req.ticker == "AAPL"
        assert req.quantity == 10
        assert req.side == "buy"

    def test_valid_sell(self):
        req = TradeRequest(ticker="AAPL", quantity=5, side="sell")
        assert req.side == "sell"

    def test_invalid_side_rejected(self):
        with pytest.raises(ValidationError):
            TradeRequest(ticker="AAPL", quantity=5, side="hold")

    def test_quantity_must_be_positive(self):
        with pytest.raises(ValidationError):
            TradeRequest(ticker="AAPL", quantity=0, side="buy")

    def test_negative_quantity_rejected(self):
        with pytest.raises(ValidationError):
            TradeRequest(ticker="AAPL", quantity=-1, side="buy")

    def test_fractional_quantity_allowed(self):
        req = TradeRequest(ticker="AAPL", quantity=0.5, side="buy")
        assert req.quantity == 0.5


class TestPositionResponse:
    def test_all_fields(self):
        pos = PositionResponse(
            ticker="AAPL",
            quantity=10,
            avg_cost=150.0,
            current_price=191.23,
            unrealized_pnl=412.30,
            pnl_pct=27.49,
        )
        assert pos.ticker == "AAPL"
        assert pos.unrealized_pnl == 412.30


class TestPortfolioResponse:
    def test_portfolio_shape(self):
        portfolio = PortfolioResponse(
            cash_balance=8500.0,
            positions=[],
            total_value=8500.0,
        )
        assert portfolio.cash_balance == 8500.0
        assert portfolio.positions == []


class TestPortfolioHistoryPoint:
    def test_history_point(self):
        point = PortfolioHistoryPoint(
            recorded_at="2026-04-11T17:33:09+00:00",
            total_value=10000.0,
        )
        assert point.total_value == 10000.0
