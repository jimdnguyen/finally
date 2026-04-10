"""Integration tests for chat service layer functions.

Tests portfolio context injection (D-02, D-03), conversation history loading,
LLM action execution with partial failure handling (CHAT-03), message persistence,
and mock mode behavior (CHAT-04).
"""

import json
import os
import sqlite3
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.chat.models import ChatResponse, TradeAction, WatchlistAction
from app.chat.service import (
    build_context_block,
    execute_chat_mock,
    execute_llm_actions,
    load_conversation_history,
    save_chat_message,
)
from app.market import PriceCache, PriceUpdate


@pytest.fixture
def sample_price_update() -> PriceUpdate:
    """Create a sample PriceUpdate for testing."""
    return PriceUpdate(ticker="AAPL", price=190.0, previous_price=185.0, timestamp="2026-04-10T10:00:00Z")


class TestBuildContextBlock:
    """Test portfolio context block building (D-02, D-03)."""

    def test_build_context_block_prose_format(self, test_db: sqlite3.Connection, price_cache: PriceCache, sample_price_update: PriceUpdate):
        """Test that context block is human-readable prose, not JSON or markdown.

        Per D-02: Context must be structured prose (natural language paragraph format),
        not JSON or markdown tables.
        """
        # Populate price cache
        price_cache.update("AAPL", 190.0, "2026-04-10T10:00:00Z")

        cursor = test_db.cursor()
        context = build_context_block(cursor, price_cache)

        # Assert: result is prose, not JSON
        assert "{" not in context or "\"" not in context  # No JSON-style braces
        assert "|" not in context  # No markdown table pipes
        assert "---" not in context  # No markdown table separators

        # Assert: result contains expected prose elements
        assert "Your portfolio:" in context
        assert "cash" in context
        assert "Total value:" in context
        assert "Watchlist:" in context

    def test_build_context_block_fresh_on_every_call(self, test_db: sqlite3.Connection, price_cache: PriceCache):
        """Test that build_context_block rebuilds fresh context on every call (D-03).

        Per D-03: Context must be built fresh from get_portfolio_data() on every request
        (not cached). If prices change between calls, the context must reflect the new prices.
        """
        cursor = test_db.cursor()

        # First call
        price_cache.update("AAPL", 190.0)
        context1 = build_context_block(cursor, price_cache)

        # Second call with same state should return identical context
        context2 = build_context_block(cursor, price_cache)
        assert context1 == context2

        # Update price and call again
        price_cache.update("AAPL", 195.0)
        context3 = build_context_block(cursor, price_cache)

        # Context should reflect updated price (not cached)
        assert "195.00" in context3
        assert context3 != context1  # Context changed

    def test_build_context_block_with_positions(self, test_db: sqlite3.Connection, price_cache: PriceCache):
        """Test context building with existing positions."""
        # Insert a position
        cursor = test_db.cursor()
        cursor.execute(
            """
            INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
            VALUES ('pos-1', 'default', 'AAPL', 10, 185.0, datetime('now'))
        """
        )
        test_db.commit()

        # Add price to cache
        price_cache.update("AAPL", 190.0)

        context = build_context_block(cursor, price_cache)

        # Assert: context includes position details
        assert "AAPL" in context
        assert "185.00" in context  # avg cost
        assert "190.00" in context  # current price


class TestLoadConversationHistory:
    """Test conversation history loading."""

    def test_load_conversation_history(self, test_db: sqlite3.Connection):
        """Test that load_conversation_history returns messages in chronological order."""
        cursor = test_db.cursor()

        # Insert 5 messages
        messages = [
            ("user", "What's my portfolio?"),
            ("assistant", "Your portfolio is worth $10,000."),
            ("user", "Buy AAPL"),
            ("assistant", "Buying 10 AAPL shares at $190."),
            ("user", "Thanks"),
        ]

        for i, (role, content) in enumerate(messages):
            cursor.execute(
                """
                INSERT INTO chat_messages (id, user_id, role, content, created_at)
                VALUES (?, ?, ?, ?, datetime('now', '+' || ? || ' seconds'))
            """,
                (f"msg-{i}", "default", role, content, i),
            )
        test_db.commit()

        # Load history
        history = load_conversation_history(cursor, limit=10)

        # Assert: 5 messages loaded
        assert len(history) == 5

        # Assert: chronological order (oldest first)
        assert history[0]["content"] == "What's my portfolio?"
        assert history[-1]["content"] == "Thanks"

        # Assert: all messages have role and content
        for msg in history:
            assert "role" in msg
            assert "content" in msg

    def test_load_conversation_history_limit(self, test_db: sqlite3.Connection):
        """Test that load_conversation_history respects limit parameter."""
        cursor = test_db.cursor()

        # Insert 10 messages
        for i in range(10):
            cursor.execute(
                """
                INSERT INTO chat_messages (id, user_id, role, content, created_at)
                VALUES (?, ?, ?, ?, datetime('now', '+' || ? || ' seconds'))
            """,
                (f"msg-{i}", "default", "user", f"Message {i}", i),
            )
        test_db.commit()

        # Load with limit=5
        history = load_conversation_history(cursor, limit=5)

        # Assert: only 5 most recent messages returned
        assert len(history) == 5
        assert history[-1]["content"] == "Message 9"  # Most recent


class TestExecuteLLMActions:
    """Test trade and watchlist action execution with partial failure handling."""

    @pytest.mark.asyncio
    async def test_execute_llm_actions_single_trade(self, test_db: sqlite3.Connection, price_cache: PriceCache):
        """Test executing a single valid trade."""
        # Set up initial state
        price_cache.update("AAPL", 190.0)

        # Create response with one trade
        llm_response = ChatResponse(
            message="Buying AAPL",
            trades=[TradeAction(ticker="AAPL", side="buy", quantity=1)],
            watchlist_changes=[],
        )

        # Execute actions
        executed = await execute_llm_actions(test_db, llm_response, price_cache)

        # Assert: trade executed
        assert len(executed["trades"]) == 1
        assert executed["trades"][0]["ticker"] == "AAPL"
        assert executed["trades"][0]["side"] == "buy"
        assert len(executed["errors"]) == 0

    @pytest.mark.asyncio
    async def test_execute_llm_actions_partial_failure(self, test_db: sqlite3.Connection, price_cache: PriceCache):
        """Test continue-and-report pattern: execute valid trades, report invalid ones (CHAT-03).

        When multiple trades are requested and one fails validation, the valid trade
        should execute and the error should be reported without aborting.
        """
        # Set up: $10,000 cash initially
        price_cache.update("AAPL", 190.0)
        price_cache.update("GOOGL", 175.0)

        # Create response with 2 trades:
        # 1. Valid: buy 10 AAPL = $1,900 (sufficient cash)
        # 2. Invalid: buy 1000 GOOGL = $175,000 (insufficient cash)
        llm_response = ChatResponse(
            message="Buying stocks",
            trades=[
                TradeAction(ticker="AAPL", side="buy", quantity=10),
                TradeAction(ticker="GOOGL", side="buy", quantity=1000),  # Will fail
            ],
            watchlist_changes=[],
        )

        # Execute actions
        executed = await execute_llm_actions(test_db, llm_response, price_cache)

        # Assert: first trade executed successfully
        assert len(executed["trades"]) == 1
        assert executed["trades"][0]["ticker"] == "AAPL"

        # Assert: error for second trade reported
        assert len(executed["errors"]) >= 1
        assert any("GOOGL" in error or "insufficient" in error.lower() for error in executed["errors"])

    @pytest.mark.asyncio
    async def test_execute_llm_actions_watchlist_changes(self, test_db: sqlite3.Connection, price_cache: PriceCache):
        """Test executing watchlist add/remove actions (CHAT-03)."""
        # Use a ticker not in the default watchlist
        llm_response = ChatResponse(
            message="Managing watchlist",
            trades=[],
            watchlist_changes=[
                WatchlistAction(ticker="PYPL", action="add"),
            ],
        )

        executed = await execute_llm_actions(test_db, llm_response, price_cache)

        # Assert: watchlist change executed
        assert len(executed["watchlist_changes"]) == 1
        assert executed["watchlist_changes"][0]["action"] == "added"

        # Verify in database
        cursor = test_db.cursor()
        cursor.execute("SELECT ticker FROM watchlist WHERE ticker='PYPL'")
        assert cursor.fetchone() is not None


class TestExecuteChatMock:
    """Test mock mode response generation (CHAT-04)."""

    def test_execute_chat_mock_mode(self):
        """Test that mock mode returns deterministic response (CHAT-04)."""
        mock = execute_chat_mock()

        # Assert: response structure is valid
        assert isinstance(mock, ChatResponse)

        # Assert: hardcoded message
        assert mock.message == "I'll help you manage your portfolio. Buying 1 AAPL at market price."

        # Assert: one sample trade
        assert len(mock.trades) == 1
        assert mock.trades[0].ticker == "AAPL"
        assert mock.trades[0].side == "buy"
        assert mock.trades[0].quantity == 1

        # Assert: no watchlist changes
        assert len(mock.watchlist_changes) == 0

    def test_execute_chat_mock_is_deterministic(self):
        """Test that mock response is always identical (no randomness)."""
        mock1 = execute_chat_mock()
        mock2 = execute_chat_mock()

        assert mock1.message == mock2.message
        assert mock1.trades == mock2.trades
        assert mock1.watchlist_changes == mock2.watchlist_changes


class TestSaveChatMessage:
    """Test message persistence to database (CHAT-05)."""

    def test_save_chat_message_user(self, test_db: sqlite3.Connection):
        """Test saving a user message (CHAT-05)."""
        cursor = test_db.cursor()

        # Save user message
        msg_id = save_chat_message(cursor, "user", "What's my balance?")
        test_db.commit()

        # Verify in database
        cursor.execute(
            "SELECT role, content, actions FROM chat_messages WHERE id=?", (msg_id,)
        )
        row = cursor.fetchone()

        assert row is not None
        assert row[0] == "user"  # role
        assert row[1] == "What's my balance?"  # content
        assert row[2] is None  # actions (None for user messages)

    def test_save_chat_message_with_actions(self, test_db: sqlite3.Connection):
        """Test saving an assistant message with executed actions (CHAT-05)."""
        cursor = test_db.cursor()

        # Save assistant message with actions
        actions = {
            "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 1}],
            "errors": [],
        }
        msg_id = save_chat_message(cursor, "assistant", "Buying AAPL", actions=actions)
        test_db.commit()

        # Verify in database
        cursor.execute(
            "SELECT content, actions FROM chat_messages WHERE id=?", (msg_id,)
        )
        row = cursor.fetchone()

        assert row is not None
        assert row[0] == "Buying AAPL"
        assert json.loads(row[1]) == actions  # Actions stored as JSON
