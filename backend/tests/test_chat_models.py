"""Unit tests for chat Pydantic models."""

import pytest
from pydantic import ValidationError

from app.chat.models import (
    ChatRequest,
    ChatResponse,
    LLMResponse,
    TradeRequest,
    WatchlistChange,
)

# ─── TradeRequest ────────────────────────────────────────────────────────────

def test_trade_request_valid():
    t = TradeRequest(ticker="AAPL", side="buy", quantity=10)
    assert t.ticker == "AAPL"
    assert t.side == "buy"
    assert t.quantity == 10


def test_trade_request_sell():
    t = TradeRequest(ticker="TSLA", side="sell", quantity=0.5)
    assert t.side == "sell"


def test_trade_request_invalid_side():
    with pytest.raises(ValidationError):
        TradeRequest(ticker="AAPL", side="hold", quantity=1)


def test_trade_request_zero_quantity():
    with pytest.raises(ValidationError):
        TradeRequest(ticker="AAPL", side="buy", quantity=0)


def test_trade_request_negative_quantity():
    with pytest.raises(ValidationError):
        TradeRequest(ticker="AAPL", side="buy", quantity=-5)


# ─── WatchlistChange ─────────────────────────────────────────────────────────

def test_watchlist_change_add():
    w = WatchlistChange(ticker="PYPL", action="add")
    assert w.action == "add"


def test_watchlist_change_remove():
    w = WatchlistChange(ticker="PYPL", action="remove")
    assert w.action == "remove"


def test_watchlist_change_invalid_action():
    with pytest.raises(ValidationError):
        WatchlistChange(ticker="PYPL", action="watch")


# ─── LLMResponse ─────────────────────────────────────────────────────────────

def test_llm_response_minimal():
    r = LLMResponse(message="Hello")
    assert r.message == "Hello"
    assert r.trades == []
    assert r.watchlist_changes == []


def test_llm_response_with_trades():
    r = LLMResponse(
        message="Buying AAPL",
        trades=[{"ticker": "AAPL", "side": "buy", "quantity": 5}],
    )
    assert len(r.trades) == 1
    assert r.trades[0].ticker == "AAPL"


def test_llm_response_missing_message():
    with pytest.raises(ValidationError):
        LLMResponse()


# ─── ChatRequest ─────────────────────────────────────────────────────────────

def test_chat_request_valid():
    r = ChatRequest(message="What is my portfolio worth?")
    assert r.message == "What is my portfolio worth?"


def test_chat_request_empty_message():
    with pytest.raises(ValidationError):
        ChatRequest(message="")


def test_chat_request_message_too_long():
    with pytest.raises(ValidationError):
        ChatRequest(message="x" * 2001)


def test_chat_request_max_length():
    r = ChatRequest(message="x" * 2000)
    assert len(r.message) == 2000


# ─── ChatResponse ────────────────────────────────────────────────────────────

def test_chat_response_defaults():
    r = ChatResponse(message="Hello!")
    assert r.message == "Hello!"
    assert r.trades_executed == []
    assert r.watchlist_changes_applied == []
