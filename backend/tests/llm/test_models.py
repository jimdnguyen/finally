"""Tests for LLM Pydantic models."""

import pytest
from app.llm.models import TradeAction, WatchlistAction, ChatResponse


def test_trade_action_valid():
    """TradeAction with valid data."""
    action = TradeAction(ticker="AAPL", side="buy", quantity=10.5)
    assert action.ticker == "AAPL"
    assert action.side == "buy"
    assert action.quantity == 10.5


def test_trade_action_invalid_side():
    """TradeAction rejects invalid side."""
    with pytest.raises(ValueError):
        TradeAction(ticker="AAPL", side="invalid", quantity=10)


def test_trade_action_invalid_quantity():
    """TradeAction rejects non-positive quantity."""
    with pytest.raises(ValueError):
        TradeAction(ticker="AAPL", side="buy", quantity=0)

    with pytest.raises(ValueError):
        TradeAction(ticker="AAPL", side="buy", quantity=-5)


def test_watchlist_action_valid():
    """WatchlistAction with valid data."""
    action = WatchlistAction(ticker="AAPL", action="add")
    assert action.ticker == "AAPL"
    assert action.action == "add"

    action = WatchlistAction(ticker="AAPL", action="remove")
    assert action.action == "remove"


def test_watchlist_action_invalid_action():
    """WatchlistAction rejects invalid action."""
    with pytest.raises(ValueError):
        WatchlistAction(ticker="AAPL", action="invalid")


def test_chat_response_valid():
    """ChatResponse with all fields."""
    response = ChatResponse(
        message="Hello!",
        trades=[TradeAction(ticker="AAPL", side="buy", quantity=5)],
        watchlist_changes=[WatchlistAction(ticker="GOOGL", action="add")],
    )
    assert response.message == "Hello!"
    assert len(response.trades) == 1
    assert response.trades[0].ticker == "AAPL"
    assert len(response.watchlist_changes) == 1


def test_chat_response_defaults():
    """ChatResponse with defaults for empty arrays."""
    response = ChatResponse(message="Just a message")
    assert response.message == "Just a message"
    assert response.trades == []
    assert response.watchlist_changes == []


def test_chat_response_json_roundtrip():
    """ChatResponse can be serialized and deserialized."""
    original = ChatResponse(
        message="Test",
        trades=[TradeAction(ticker="AAPL", side="sell", quantity=2.5)],
    )

    json_str = original.model_dump_json()
    restored = ChatResponse.model_validate_json(json_str)

    assert restored.message == original.message
    assert len(restored.trades) == 1
    assert restored.trades[0].ticker == "AAPL"
    assert restored.trades[0].side == "sell"
    assert restored.trades[0].quantity == 2.5
