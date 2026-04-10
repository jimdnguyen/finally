"""Chat endpoint with LLM integration."""

import os
import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.db import get_db
from app.market import PriceCache, MarketDataSource
from app.llm import ChatResponse
from app.llm.service import build_portfolio_context, call_llm
from app.llm.mock import get_mock_response
from app.services import execute_trade_service, add_to_watchlist, remove_from_watchlist
from app.services.trade_service import TradeExecutionError
from app.services.watchlist_service import WatchlistError

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    """Chat message from user."""

    message: str


@router.post("")
async def chat(request: Request, chat_request: ChatRequest):
    """Chat endpoint: send message, get response from LLM.

    Auto-executes trades and watchlist changes if requested.
    Returns {message, trades_executed, watchlist_changes, errors}.
    """
    price_cache: PriceCache = request.app.state.price_cache
    market_source: MarketDataSource = request.app.state.market_source
    user_message = chat_request.message.strip()

    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    async with get_db() as db:
        # Check if mock mode is enabled
        use_mock = os.getenv("LLM_MOCK", "false").lower() == "true"

        # Build portfolio context
        portfolio_context = await build_portfolio_context(db, price_cache)

        # Load last 20 messages from chat history
        chat_history_rows = await db.execute(
            """
            SELECT role, content FROM chat_messages
            WHERE user_id = 'default'
            ORDER BY created_at DESC
            LIMIT 20
            """
        )
        chat_rows = await chat_history_rows.fetchall()

        # Build messages list (reverse order for LLM)
        messages = []
        for row in reversed(chat_rows):
            messages.append({"role": row["role"], "content": row["content"]})

        # Add current user message
        messages.append({"role": "user", "content": user_message})

        # Call LLM
        if use_mock:
            llm_response = get_mock_response()
        else:
            llm_response = await call_llm(messages, portfolio_context)

        # Execute trades
        trades_executed = []
        trade_errors = []

        for trade_action in llm_response.trades:
            try:
                result = await execute_trade_service(
                    db,
                    price_cache,
                    trade_action.ticker,
                    trade_action.quantity,
                    trade_action.side,
                )
                trades_executed.append(result)
            except TradeExecutionError as e:
                trade_errors.append({"ticker": trade_action.ticker, "error": str(e)})

        # Execute watchlist changes
        watchlist_changes_done = []
        watchlist_errors = []

        for wl_action in llm_response.watchlist_changes:
            try:
                if wl_action.action == "add":
                    result = await add_to_watchlist(db, wl_action.ticker)
                    await market_source.add_ticker(wl_action.ticker)
                elif wl_action.action == "remove":
                    result = await remove_from_watchlist(db, wl_action.ticker)
                    await market_source.remove_ticker(wl_action.ticker)
                else:
                    raise WatchlistError(f"Invalid action: {wl_action.action}")

                watchlist_changes_done.append({**result, "action": wl_action.action})
            except WatchlistError as e:
                watchlist_errors.append({"ticker": wl_action.ticker, "error": str(e)})

        # Build actions JSON for storage
        actions = {
            "trades_executed": trades_executed,
            "trade_errors": trade_errors,
            "watchlist_changes": watchlist_changes_done,
            "watchlist_errors": watchlist_errors,
        }

        # Store user message
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            """
            INSERT INTO chat_messages (id, user_id, role, content, created_at)
            VALUES (?, 'default', ?, ?, ?)
            """,
            (str(uuid.uuid4()), "user", user_message, now),
        )

        # Store assistant response with actions
        await db.execute(
            """
            INSERT INTO chat_messages (id, user_id, role, content, actions, created_at)
            VALUES (?, 'default', ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                "assistant",
                llm_response.message,
                json.dumps(actions),
                now,
            ),
        )

        await db.commit()

    return {
        "message": llm_response.message,
        "trades_executed": trades_executed,
        "watchlist_changes": watchlist_changes_done,
        "errors": trade_errors + watchlist_errors if (trade_errors or watchlist_errors) else [],
    }
