"""Pytest fixtures for chat module testing.

Provides mock LLM responses and fixtures for deterministic testing (CHAT-04).
"""

import pytest

from app.chat.models import ChatResponse, TradeAction, WatchlistAction


@pytest.fixture
def mock_llm_response() -> ChatResponse:
    """Return a deterministic mock ChatResponse for CHAT-04 testing.

    This fixture provides a consistent, hardcoded response that can be used
    in unit and E2E tests without calling OpenRouter. The response is always
    identical (no randomness), making tests deterministic.
    """
    return ChatResponse(
        message="I'll help you manage your portfolio. Buying 1 AAPL at market price.",
        trades=[
            TradeAction(ticker="AAPL", side="buy", quantity=1),
        ],
        watchlist_changes=[],
    )


@pytest.fixture
def mock_llm_response_multi_action() -> ChatResponse:
    """Return a more complex mock ChatResponse with multiple trades and watchlist changes.

    Useful for testing complex LLM responses with multiple simultaneous actions.
    """
    return ChatResponse(
        message="Rebalancing your portfolio: selling GOOGL, adding TSLA to watchlist.",
        trades=[
            TradeAction(ticker="GOOGL", side="sell", quantity=2),
        ],
        watchlist_changes=[
            WatchlistAction(ticker="TSLA", action="add"),
        ],
    )


@pytest.fixture
def mock_llm_response_no_action() -> ChatResponse:
    """Return a mock ChatResponse with only a conversational message, no trades.

    Useful for testing LLM responses that provide analysis without action items.
    """
    return ChatResponse(
        message="Your portfolio is well-diversified across tech and finance sectors.",
        trades=[],
        watchlist_changes=[],
    )
