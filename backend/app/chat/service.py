"""Chat service layer: LLM orchestration, portfolio context injection, and auto-execution.

Implements the core chat flow: build portfolio context, load conversation history,
call OpenRouter via LiteLLM with structured output, auto-execute trades and watchlist
changes, and persist the exchange to the database.

Critical for CHAT-01, CHAT-03, CHAT-05, CHAT-06 requirements.
"""

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import litellm
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import ValidationError

from app.chat.models import ChatResponse, TradeAction, WatchlistAction
from app.market import PriceCache
from app.portfolio.service import execute_trade, get_portfolio_data


def build_context_block(cursor: sqlite3.Cursor, price_cache: PriceCache) -> str:
    """Build fresh portfolio context as human-readable prose for LLM system prompt.

    Per D-02: Format as structured prose (natural language), NOT JSON or markdown tables.
    Per D-03: This function builds fresh context on every request (not cached).
    Never call this function before the LLM call; always build fresh to ensure
    current prices and positions reflect recent trades.

    Args:
        cursor: SQLite cursor with active DB connection
        price_cache: PriceCache instance for live ticker prices

    Returns:
        str: Prose-formatted portfolio context. Example:
        "Your portfolio: $8,234 cash. Positions: AAPL 10 shares at avg $185.00,
         current $192.40 (+$74.00, +3.6%). Total value: $9,158.00.
         Watchlist: AAPL $192.40, TSLA $248.10, NVDA $875.50 ..."
    """
    # Fetch portfolio data (includes positions with current prices and P&L)
    data = get_portfolio_data(cursor, price_cache)
    cash = data["cash_balance"]
    total_value = data["total_value"]

    # Build positions prose (largest positions first — most relevant for LLM analysis)
    positions_sorted = sorted(
        data["positions"],
        key=lambda p: p.get("current_price", 0) * p.get("quantity", 0),
        reverse=True,
    )

    positions_prose = []
    for pos in positions_sorted:
        ticker = pos["ticker"]
        qty = pos["quantity"]
        avg_cost = pos["avg_cost"]
        current_price = pos["current_price"]
        unrealized_pnl = pos["unrealized_pnl"]
        change_pct = pos["change_percent"]

        # Format as human-readable position summary
        pos_str = (
            f"{ticker} {qty:.2f} shares at avg ${avg_cost:.2f}, "
            f"current ${current_price:.2f} "
            f"(+${unrealized_pnl:.2f}, {change_pct:+.1f}%)"
        )
        positions_prose.append(pos_str)

    # Fetch watchlist for context
    cursor.execute(
        "SELECT ticker FROM watchlist WHERE user_id='default' ORDER BY ticker"
    )
    watchlist_tickers = [row[0] for row in cursor.fetchall()]

    # Build watchlist prose with current prices
    watchlist_prose = []
    for ticker in watchlist_tickers:
        price_update = price_cache.get(ticker)
        if price_update:
            price_str = f"{ticker} ${price_update.price:.2f}"
            watchlist_prose.append(price_str)
        else:
            watchlist_prose.append(f"{ticker} (no price)")

    # Assemble final prose block
    context = f"""Your portfolio: ${cash:.2f} cash. Positions: {', '.join(positions_prose) if positions_prose else 'none'}. Total value: ${total_value:.2f}. Watchlist: {', '.join(watchlist_prose) if watchlist_prose else 'empty'}."""

    return context


def load_conversation_history(cursor: sqlite3.Cursor, limit: int = 10) -> list[dict]:
    """Load recent conversation history from chat_messages table.

    Fetches the last N messages from the conversation history, excludes the current
    request, and returns them in chronological order (oldest first) for the LLM context.

    Args:
        cursor: SQLite cursor with active DB connection
        limit: Maximum number of recent messages to load (default 10)

    Returns:
        list[dict]: List of {"role": "user"/"assistant", "content": "..."} dicts
        in chronological order (oldest first). Empty list if no history.
    """
    cursor.execute(
        """
        SELECT role, content FROM chat_messages
        WHERE user_id='default'
        ORDER BY created_at DESC
        LIMIT ?
    """,
        (limit,),
    )
    messages = cursor.fetchall()

    # Reverse to chronological order (oldest first)
    history = [{"role": role, "content": content} for role, content in reversed(messages)]
    return history


def call_llm_structured(
    system_prompt: str, messages: list[dict], schema: type
) -> ChatResponse:
    """Call OpenRouter LLM via LiteLLM with structured output.

    CRITICAL for CHAT-06: Sets litellm._openrouter_force_structured_output = True
    before the completion() call. This flag is required to enable structured outputs
    on OpenRouter; without it, the response is treated as text and structured output
    validation fails.

    Also implements the critical bug fix from the cerebras skill: uses the double-prefix
    model string "openrouter/openrouter/free" (not "openrouter/free"). LiteLLM strips
    the provider prefix, so the double prefix survives and resolves correctly to the
    OpenRouter free tier via Cerebras.

    Args:
        system_prompt: System message with portfolio context (per D-03)
        messages: List of {"role": "...", "content": "..."} dicts (history + current)
        schema: Pydantic BaseModel class (ChatResponse) for structured output

    Returns:
        ChatResponse: Validated structured response from the LLM

    Raises:
        ValidationError: If LLM response doesn't match ChatResponse schema
        HTTPException: If LLM call fails or returns unexpected format
    """
    # CRITICAL BUG FIX (CHAT-06): Set this flag BEFORE calling completion()
    # Without this flag, OpenRouter treats the response as plain text, not structured output
    litellm._openrouter_force_structured_output = True

    # Build messages list with system prompt
    full_messages = [{"role": "system", "content": system_prompt}] + messages

    # Build call kwargs with model, messages, and Cerebras routing
    call_kwargs = {
        "model": "openrouter/openrouter/free",  # Double prefix (bug fix)
        "messages": full_messages,
        "response_format": schema,
        "extra_body": {"provider": {"order": ["cerebras"]}},
    }

    # Call LiteLLM completion
    response = litellm.completion(**call_kwargs)

    # Extract JSON from response
    result_json = response.choices[0].message.content or ""

    # Validate and parse with Pydantic schema
    try:
        validated_response = schema.model_validate_json(result_json)
    except ValidationError as e:
        raise HTTPException(
            status_code=400,
            detail=f"LLM response does not match ChatResponse schema: {e}",
        )

    return validated_response


def save_chat_message(
    cursor: sqlite3.Cursor, role: str, content: str, actions: dict | None = None
) -> str:
    """Persist a chat message and optional executed actions to the database.

    Inserts a row into chat_messages table with the given role, content, and actions.
    Actions (if provided) are serialized as JSON.

    Args:
        cursor: SQLite cursor with active DB connection
        role: "user" or "assistant"
        content: Message text
        actions: Optional dict of executed actions (trades, watchlist_changes, errors)

    Returns:
        str: The UUID of the inserted message
    """
    message_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    actions_json = json.dumps(actions) if actions is not None else None

    cursor.execute(
        """
        INSERT INTO chat_messages (id, user_id, role, content, actions, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """,
        (message_id, "default", role, content, actions_json, now),
    )

    return message_id


async def execute_llm_actions(
    db: sqlite3.Connection, llm_response: ChatResponse, price_cache: PriceCache
) -> dict:
    """Execute trades and watchlist changes from LLM response with continue-and-report pattern.

    Per CHAT-03: When multiple trades or watchlist changes are requested, execute each one.
    If any fail validation, collect the error message and continue with the remaining actions.
    This ensures partial successes are reported to the user rather than failing the entire
    request.

    Args:
        db: SQLite connection for DB access
        llm_response: ChatResponse with trades and watchlist_changes to execute
        price_cache: PriceCache for trade execution

    Returns:
        dict with keys:
            - "trades": List of successfully executed trades
            - "watchlist_changes": List of successfully executed watchlist changes
            - "errors": List of error messages from failed trades/changes
    """
    executed_actions = {"trades": [], "watchlist_changes": [], "errors": []}

    # Execute trades with continue-and-report pattern
    for trade in llm_response.trades:
        try:
            result = await execute_trade(
                db,
                trade.ticker,
                trade.side,
                Decimal(str(trade.quantity)),
                price_cache,
            )
            executed_actions["trades"].append(result)
        except HTTPException as e:
            executed_actions["errors"].append(f"Trade failed: {e.detail}")
        except Exception as e:
            executed_actions["errors"].append(f"Trade error: {str(e)}")

    # Execute watchlist changes (import here to avoid circular dependency)
    from app.watchlist.service import add_watchlist_ticker, remove_watchlist_ticker

    for change in llm_response.watchlist_changes:
        try:
            if change.action == "add":
                result = add_watchlist_ticker(db, change.ticker)
            elif change.action == "remove":
                result = remove_watchlist_ticker(db, change.ticker)
            else:
                result = {"error": f"Unknown watchlist action: {change.action}"}
            executed_actions["watchlist_changes"].append(result)
        except HTTPException as e:
            executed_actions["errors"].append(f"Watchlist change failed: {e.detail}")
        except Exception as e:
            executed_actions["errors"].append(f"Watchlist error: {str(e)}")

    return executed_actions


def execute_chat_mock() -> ChatResponse:
    """Return deterministic mock ChatResponse when LLM_MOCK=true (CHAT-04).

    Per CHAT-04: In mock mode, return a hardcoded response with a friendly message
    and one sample buy trade (AAPL). This enables fast, deterministic E2E tests
    without calling OpenRouter.

    Returns:
        ChatResponse: Hardcoded mock response with message + 1 trade, no watchlist changes
    """
    return ChatResponse(
        message="I'll help you manage your portfolio. Buying 1 AAPL at market price.",
        trades=[TradeAction(ticker="AAPL", side="buy", quantity=1)],
        watchlist_changes=[],
    )


async def execute_chat(
    db: sqlite3.Connection, user_message: str, price_cache: PriceCache
) -> dict:
    """Execute full chat request: context injection, LLM call, auto-execution, persistence.

    Orchestrator function that ties together all chat components:
    1. Check for mock mode (LLM_MOCK=true)
    2. Build fresh portfolio context (D-03)
    3. Load conversation history
    4. Build system prompt with context (D-03)
    5. Call LLM with structured output
    6. Auto-execute trades and watchlist changes
    7. Persist user message and assistant response to DB

    Per CHAT-06: Calls call_llm_structured() which sets the critical OpenRouter flag.

    Args:
        db: SQLite connection for DB and history access
        user_message: User's chat input
        price_cache: PriceCache for context and trade execution

    Returns:
        dict with keys:
            - "llm_response": ChatResponse from LLM (or mock)
            - "executed_actions": Dict of executed trades, watchlist changes, and errors
            - "error": String describing any critical error, or None
    """

    async def _execute_chat_async():
        # Check for mock mode
        if os.environ.get("LLM_MOCK") == "true":
            mock_response = execute_chat_mock()
            # Still save messages even in mock mode
            cursor = db.cursor()
            save_chat_message(cursor, "user", user_message)
            save_chat_message(cursor, "assistant", mock_response.message)
            db.commit()
            return {
                "llm_response": mock_response,
                "executed_actions": {"trades": [], "watchlist_changes": [], "errors": []},
                "error": None,
            }

        cursor = db.cursor()

        # Build fresh portfolio context (D-03)
        context = build_context_block(cursor, price_cache)

        # Load conversation history
        history = load_conversation_history(cursor, limit=10)

        # Build system prompt with context
        system_prompt = f"""You are FinAlly, an AI trading assistant. You help users manage their investment portfolio.

Current portfolio state:
{context}

Be concise and data-driven. Analyze positions, suggest trades with reasoning, and execute when requested.
Always respond with valid JSON matching this structure:
{{"message": "...", "trades": [], "watchlist_changes": []}}
"""

        # Build full message list (history + current user message)
        full_messages = history + [{"role": "user", "content": user_message}]

        # Call LLM with structured output (this sets the CHAT-06 flag)
        try:
            llm_response = call_llm_structured(system_prompt, full_messages, ChatResponse)
        except ValidationError as e:
            error_msg = f"LLM response validation failed: {str(e)}"
            return {
                "llm_response": ChatResponse(
                    message=f"I encountered an error processing your request: {error_msg}",
                    trades=[],
                    watchlist_changes=[],
                ),
                "executed_actions": {"trades": [], "watchlist_changes": [], "errors": [error_msg]},
                "error": error_msg,
            }
        except Exception as e:
            error_msg = f"LLM call failed: {str(e)}"
            return {
                "llm_response": ChatResponse(
                    message=f"I'm temporarily unavailable. Please try again later.",
                    trades=[],
                    watchlist_changes=[],
                ),
                "executed_actions": {"trades": [], "watchlist_changes": [], "errors": [error_msg]},
                "error": error_msg,
            }

        # Auto-execute trades and watchlist changes (async)
        executed_actions = await execute_llm_actions(db, llm_response, price_cache)

        # Persist user message and assistant response
        save_chat_message(cursor, "user", user_message)
        save_chat_message(cursor, "assistant", llm_response.message, actions=executed_actions)

        db.commit()

        return {
            "llm_response": llm_response,
            "executed_actions": executed_actions,
            "error": None,
        }

    return await _execute_chat_async()
