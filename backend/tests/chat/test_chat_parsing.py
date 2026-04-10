"""Unit tests for chat module Pydantic schemas - parsing and validation (TEST-02).

Tests ChatResponse, TradeAction, and WatchlistAction schema validation via
.model_validate_json() with valid JSON, malformed JSON, missing fields, and
invalid enum values.
"""

import json

import pytest
from pydantic import ValidationError

from app.chat.models import ChatResponse, TradeAction, WatchlistAction


class TestTradeActionValidation:
    """Test TradeAction schema validation."""

    def test_trade_action_valid(self) -> None:
        """Test that TradeAction with valid fields parses successfully."""
        trade = TradeAction(ticker="AAPL", side="buy", quantity=10.0)
        assert trade.ticker == "AAPL"
        assert trade.side == "buy"
        assert trade.quantity == 10.0

    def test_trade_action_json_valid(self) -> None:
        """Test TradeAction.model_validate_json() with valid JSON."""
        json_str = '{"ticker": "AAPL", "side": "buy", "quantity": 10}'
        trade = TradeAction.model_validate_json(json_str)
        assert trade.ticker == "AAPL"
        assert trade.side == "buy"
        assert trade.quantity == 10.0

    def test_trade_action_missing_quantity(self) -> None:
        """Test TradeAction rejects missing quantity field."""
        with pytest.raises(ValidationError):
            TradeAction(ticker="AAPL", side="buy")

    def test_trade_action_invalid_side(self) -> None:
        """Test TradeAction rejects invalid side value."""
        with pytest.raises(ValidationError):
            TradeAction(ticker="AAPL", side="invalid_side", quantity=10)

    def test_trade_action_zero_quantity(self) -> None:
        """Test TradeAction rejects zero quantity (gt=0 constraint)."""
        with pytest.raises(ValidationError):
            TradeAction(ticker="AAPL", side="buy", quantity=0)

    def test_trade_action_negative_quantity(self) -> None:
        """Test TradeAction rejects negative quantity."""
        with pytest.raises(ValidationError):
            TradeAction(ticker="AAPL", side="buy", quantity=-10)


class TestWatchlistActionValidation:
    """Test WatchlistAction schema validation."""

    def test_watchlist_action_valid(self) -> None:
        """Test that WatchlistAction with valid fields parses successfully."""
        action = WatchlistAction(ticker="TSLA", action="add")
        assert action.ticker == "TSLA"
        assert action.action == "add"

    def test_watchlist_action_invalid_action(self) -> None:
        """Test WatchlistAction rejects invalid action."""
        with pytest.raises(ValidationError):
            WatchlistAction(ticker="TSLA", action="invalid_action")

    def test_watchlist_action_remove_valid(self) -> None:
        """Test WatchlistAction accepts 'remove' action."""
        action = WatchlistAction(ticker="TSLA", action="remove")
        assert action.action == "remove"


class TestChatResponseValidation:
    """Test ChatResponse schema validation - the full LLM response."""

    def test_chat_response_valid_all_fields(self) -> None:
        """Test ChatResponse with message, trades, and watchlist_changes."""
        response = ChatResponse(
            message="I'll buy AAPL",
            trades=[TradeAction(ticker="AAPL", side="buy", quantity=10)],
            watchlist_changes=[WatchlistAction(ticker="TSLA", action="add")],
        )
        assert response.message == "I'll buy AAPL"
        assert len(response.trades) == 1
        assert len(response.watchlist_changes) == 1

    def test_chat_response_json_valid_all_fields(self) -> None:
        """Test ChatResponse.model_validate_json() with complete JSON."""
        json_str = """{
            "message": "Here's my analysis...",
            "trades": [
                {"ticker": "AAPL", "side": "buy", "quantity": 10}
            ],
            "watchlist_changes": [
                {"ticker": "PYPL", "action": "add"}
            ]
        }"""
        response = ChatResponse.model_validate_json(json_str)
        assert response.message == "Here's my analysis..."
        assert len(response.trades) == 1
        assert response.trades[0].ticker == "AAPL"
        assert len(response.watchlist_changes) == 1
        assert response.watchlist_changes[0].ticker == "PYPL"

    def test_chat_response_empty_trades_and_watchlist(self) -> None:
        """Test ChatResponse with empty arrays parses successfully."""
        json_str = """{
            "message": "No trades for you today.",
            "trades": [],
            "watchlist_changes": []
        }"""
        response = ChatResponse.model_validate_json(json_str)
        assert response.message == "No trades for you today."
        assert response.trades == []
        assert response.watchlist_changes == []

    def test_chat_response_message_only(self) -> None:
        """Test ChatResponse with only message field (trades/watchlist default to [])."""
        json_str = '{"message": "Hello, I can help with trading."}'
        response = ChatResponse.model_validate_json(json_str)
        assert response.message == "Hello, I can help with trading."
        assert response.trades == []
        assert response.watchlist_changes == []

    def test_chat_response_missing_message_rejected(self) -> None:
        """Test ChatResponse rejects missing required 'message' field."""
        json_str = """{
            "trades": [],
            "watchlist_changes": []
        }"""
        with pytest.raises(ValidationError):
            ChatResponse.model_validate_json(json_str)

    def test_chat_response_malformed_json_rejected(self) -> None:
        """Test ChatResponse rejects malformed JSON (syntax error)."""
        json_str = '{"message": "Hello", "trades": [invalid]}'
        with pytest.raises((ValueError, json.JSONDecodeError)):
            ChatResponse.model_validate_json(json_str)

    def test_chat_response_invalid_trade_in_array(self) -> None:
        """Test ChatResponse rejects trade object with missing quantity."""
        json_str = """{
            "message": "Trade rejected",
            "trades": [
                {"ticker": "AAPL", "side": "buy"}
            ],
            "watchlist_changes": []
        }"""
        with pytest.raises(ValidationError):
            ChatResponse.model_validate_json(json_str)

    def test_chat_response_multiple_trades(self) -> None:
        """Test ChatResponse parses multiple trades correctly."""
        json_str = """{
            "message": "Diversifying portfolio",
            "trades": [
                {"ticker": "AAPL", "side": "buy", "quantity": 10},
                {"ticker": "TSLA", "side": "sell", "quantity": 5},
                {"ticker": "GOOG", "side": "buy", "quantity": 3}
            ],
            "watchlist_changes": []
        }"""
        response = ChatResponse.model_validate_json(json_str)
        assert len(response.trades) == 3
        assert response.trades[1].ticker == "TSLA"
        assert response.trades[1].side == "sell"
        assert response.trades[1].quantity == 5.0

    def test_chat_response_multiple_watchlist_changes(self) -> None:
        """Test ChatResponse parses multiple watchlist changes correctly."""
        json_str = """{
            "message": "Updating watchlist",
            "trades": [],
            "watchlist_changes": [
                {"ticker": "PYPL", "action": "add"},
                {"ticker": "OLD", "action": "remove"},
                {"ticker": "NOVO", "action": "add"}
            ]
        }"""
        response = ChatResponse.model_validate_json(json_str)
        assert len(response.watchlist_changes) == 3
        assert response.watchlist_changes[0].action == "add"
        assert response.watchlist_changes[1].action == "remove"

    def test_chat_response_with_extra_fields_allowed(self) -> None:
        """Test ChatResponse allows extra unknown fields (Pydantic extra='allow')."""
        json_str = """{
            "message": "Hello",
            "trades": [],
            "watchlist_changes": [],
            "confidence_score": 0.95,
            "reasoning": "Markets look bullish"
        }"""
        response = ChatResponse.model_validate_json(json_str)
        assert response.message == "Hello"
        # Extra fields are allowed but not stored in the model fields

    def test_chat_response_invalid_trade_side(self) -> None:
        """Test ChatResponse rejects trade with invalid side."""
        json_str = """{
            "message": "Bad trade",
            "trades": [
                {"ticker": "AAPL", "side": "invalid_side", "quantity": 10}
            ],
            "watchlist_changes": []
        }"""
        with pytest.raises(ValidationError):
            ChatResponse.model_validate_json(json_str)

    def test_chat_response_invalid_watchlist_action(self) -> None:
        """Test ChatResponse rejects watchlist change with invalid action."""
        json_str = """{
            "message": "Bad watchlist action",
            "trades": [],
            "watchlist_changes": [
                {"ticker": "PYPL", "action": "invalid_action"}
            ]
        }"""
        with pytest.raises(ValidationError):
            ChatResponse.model_validate_json(json_str)

    def test_chat_response_trade_zero_quantity(self) -> None:
        """Test ChatResponse rejects trade with zero quantity."""
        json_str = """{
            "message": "Zero trade",
            "trades": [
                {"ticker": "AAPL", "side": "buy", "quantity": 0}
            ],
            "watchlist_changes": []
        }"""
        with pytest.raises(ValidationError):
            ChatResponse.model_validate_json(json_str)

    def test_chat_response_trade_negative_quantity(self) -> None:
        """Test ChatResponse rejects trade with negative quantity."""
        json_str = """{
            "message": "Negative trade",
            "trades": [
                {"ticker": "AAPL", "side": "buy", "quantity": -5}
            ],
            "watchlist_changes": []
        }"""
        with pytest.raises(ValidationError):
            ChatResponse.model_validate_json(json_str)

    def test_chat_response_float_quantity(self) -> None:
        """Test ChatResponse accepts fractional shares as floats."""
        json_str = """{
            "message": "Fractional shares",
            "trades": [
                {"ticker": "AAPL", "side": "buy", "quantity": 0.5}
            ],
            "watchlist_changes": []
        }"""
        response = ChatResponse.model_validate_json(json_str)
        assert response.trades[0].quantity == 0.5

    def test_chat_response_large_quantity(self) -> None:
        """Test ChatResponse accepts very large quantities."""
        json_str = """{
            "message": "Large order",
            "trades": [
                {"ticker": "AAPL", "side": "buy", "quantity": 100000}
            ],
            "watchlist_changes": []
        }"""
        response = ChatResponse.model_validate_json(json_str)
        assert response.trades[0].quantity == 100000.0
