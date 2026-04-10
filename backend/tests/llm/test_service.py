"""Tests for LLM service."""

import pytest
from app.llm.service import build_portfolio_context
from app.market import PriceCache, PriceUpdate


@pytest.mark.asyncio
async def test_build_portfolio_context(db_with_data, price_cache):
    """build_portfolio_context formats portfolio state correctly."""
    context = await build_portfolio_context(db_with_data, price_cache)

    # Check for key components
    assert "Cash Balance:" in context
    assert "Total Portfolio Value:" in context
    assert "Positions:" in context
    assert "Watchlist Prices:" in context

    # Check for some expected tickers (from seed data)
    assert "$10,000" in context or "$10000" in context


@pytest.mark.asyncio
async def test_build_portfolio_context_empty_positions(db_empty_user, price_cache):
    """build_portfolio_context handles no positions."""
    context = await build_portfolio_context(db_empty_user, price_cache)

    assert "Cash Balance:" in context
    assert "(no positions)" in context


@pytest.mark.asyncio
async def test_build_portfolio_context_with_prices(db_with_data):
    """build_portfolio_context includes prices from price_cache."""
    price_cache = PriceCache()

    # Add some prices
    price_cache.update("AAPL", 150.0, 148.0)
    price_cache.update("GOOGL", 140.0, 139.0)

    context = await build_portfolio_context(db_with_data, price_cache)

    assert "AAPL:" in context or "aapl:" in context.lower()
    assert "$150" in context or "$140" in context
