"""Unit tests for chat module Pydantic schemas (CHAT-02, CHAT-04).

Validates that ChatRequest, ChatResponse, and related models enforce
constraints and support JSON deserialization via .model_validate_json().
"""

import pytest
from pydantic import ValidationError

from app.chat.models import (
    ChatRequest,
    ChatResponse,
    TradeAction,
    WatchlistAction,
)


def test_chat_request_valid() -> None:
    """Test that ChatRequest accepts a valid user message."""
    req = ChatRequest(message="Buy 10 AAPL shares")
    assert req.message == "Buy 10 AAPL shares"
    assert isinstance(req.message, str)


def test_chat_response_valid() -> None:
    """Test that ChatResponse with message and trades validates correctly."""
    resp = ChatResponse(
        message="I'll buy AAPL for you",
        trades=[TradeAction(ticker="AAPL", side="buy", quantity=10)],
        watchlist_changes=[],
    )
    assert resp.message == "I'll buy AAPL for you"
    assert len(resp.trades) == 1
    assert resp.trades[0].ticker == "AAPL"


def test_chat_response_json_validation() -> None:
    """Test ChatResponse.model_validate_json() with valid JSON string."""
    json_str = (
        '{"message": "Buy 10 AAPL", '
        '"trades": [{"ticker": "AAPL", "side": "buy", "quantity": 10}], '
        '"watchlist_changes": []}'
    )
    resp = ChatResponse.model_validate_json(json_str)
    assert resp.message == "Buy 10 AAPL"
    assert len(resp.trades) == 1
    assert resp.trades[0].ticker == "AAPL"
    assert resp.trades[0].side == "buy"
    assert resp.trades[0].quantity == 10


def test_chat_response_malformed_json() -> None:
    """Test that ChatResponse.model_validate_json() raises ValidationError for missing message."""
    json_str = '{"trades": []}'  # missing required message field
    with pytest.raises(ValidationError):
        ChatResponse.model_validate_json(json_str)


def test_chat_response_defaults() -> None:
    """Test that ChatResponse applies default empty lists for trades and watchlist_changes."""
    resp = ChatResponse(message="Hello")
    assert resp.message == "Hello"
    assert resp.trades == []
    assert resp.watchlist_changes == []


def test_trade_action_quantity_positive() -> None:
    """Test that TradeAction quantity > 0 constraint is enforced."""
    with pytest.raises(ValidationError):
        TradeAction(ticker="AAPL", side="buy", quantity=0)

    with pytest.raises(ValidationError):
        TradeAction(ticker="AAPL", side="buy", quantity=-5)


def test_trade_action_quantity_valid() -> None:
    """Test that TradeAction accepts positive quantity values."""
    action = TradeAction(ticker="AAPL", side="buy", quantity=10.5)
    assert action.quantity == 10.5


def test_trade_action_side_enum() -> None:
    """Test that TradeAction side is constrained to 'buy' or 'sell'."""
    with pytest.raises(ValidationError):
        TradeAction(ticker="AAPL", side="INVALID", quantity=10)

    with pytest.raises(ValidationError):
        TradeAction(ticker="AAPL", side="BUY", quantity=10)  # uppercase not allowed

    # Valid sides
    buy_action = TradeAction(ticker="AAPL", side="buy", quantity=10)
    assert buy_action.side == "buy"

    sell_action = TradeAction(ticker="AAPL", side="sell", quantity=10)
    assert sell_action.side == "sell"


def test_watchlist_action_action_enum() -> None:
    """Test that WatchlistAction action is constrained to 'add' or 'remove'."""
    with pytest.raises(ValidationError):
        WatchlistAction(ticker="AAPL", action="invalid")

    with pytest.raises(ValidationError):
        WatchlistAction(ticker="AAPL", action="ADD")  # uppercase not allowed

    # Valid actions
    add_action = WatchlistAction(ticker="AAPL", action="add")
    assert add_action.action == "add"

    remove_action = WatchlistAction(ticker="AAPL", action="remove")
    assert remove_action.action == "remove"


def test_chat_response_multiple_trades_and_watchlist() -> None:
    """Test ChatResponse with multiple trades and watchlist changes."""
    resp = ChatResponse(
        message="Rebalancing your portfolio",
        trades=[
            TradeAction(ticker="AAPL", side="buy", quantity=5),
            TradeAction(ticker="GOOGL", side="sell", quantity=3),
        ],
        watchlist_changes=[
            WatchlistAction(ticker="TSLA", action="add"),
            WatchlistAction(ticker="AMZN", action="remove"),
        ],
    )
    assert len(resp.trades) == 2
    assert len(resp.watchlist_changes) == 2
    assert resp.trades[0].ticker == "AAPL"
    assert resp.trades[1].ticker == "GOOGL"


def test_chat_response_json_serialization() -> None:
    """Test that ChatResponse can be serialized and deserialized as JSON."""
    original = ChatResponse(
        message="Test message",
        trades=[TradeAction(ticker="AAPL", side="buy", quantity=5)],
        watchlist_changes=[WatchlistAction(ticker="TSLA", action="add")],
    )

    # Serialize to JSON string
    json_str = original.model_dump_json()

    # Deserialize from JSON string
    restored = ChatResponse.model_validate_json(json_str)

    assert restored.message == original.message
    assert len(restored.trades) == len(original.trades)
    assert restored.trades[0].ticker == original.trades[0].ticker
    assert len(restored.watchlist_changes) == len(original.watchlist_changes)
