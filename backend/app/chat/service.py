"""Chat service — LLM integration with portfolio context and action execution."""

import json
import os
import uuid
from datetime import datetime, timezone

import aiosqlite
import litellm
from fastapi import HTTPException

from app.market import PriceCache
from app.portfolio.service import execute_trade

from .db import load_history, save_message
from .mock import MOCK_RESPONSE
from .models import ChatResponse, LLMResponse


async def process_chat(
    message: str,
    price_cache: PriceCache,
    conn: aiosqlite.Connection,
) -> ChatResponse:
    """Process a chat message: build context, call LLM, execute actions."""
    # AC7: mock mode — skip LLM entirely
    if os.getenv("LLM_MOCK", "").lower() == "true":
        llm_resp = LLMResponse(**MOCK_RESPONSE)
        return await _execute_actions(llm_resp, message, price_cache, conn)

    # AC1: portfolio context
    system_prompt = await _build_system_prompt(price_cache, conn)

    # AC6: conversation history (oldest first)
    history = await load_history(conn)
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": message})

    # AC2: call LiteLLM — ARCH-22: model string HARDCODED
    try:
        response = await litellm.acompletion(
            model="openrouter/openrouter/free",
            messages=messages,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        parsed = json.loads(raw)
        llm_resp = LLMResponse(**parsed)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"error": "LLM unavailable", "code": "LLM_ERROR"},
        ) from exc

    return await _execute_actions(llm_resp, message, price_cache, conn)


async def _build_system_prompt(price_cache: PriceCache, conn: aiosqlite.Connection) -> str:
    """Build system prompt injected with current portfolio state."""
    cursor = await conn.execute(
        "SELECT cash_balance FROM users_profile WHERE id = 'default'"
    )
    cash = (await cursor.fetchone())[0]

    cursor = await conn.execute(
        "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id = 'default'"
    )
    pos_rows = await cursor.fetchall()

    total_pos_value = 0.0
    pos_parts = []
    for ticker, qty, avg_cost in pos_rows:
        price = price_cache.get_price(ticker) or avg_cost
        pnl = (price - avg_cost) * qty
        total_pos_value += qty * price
        pos_parts.append(f"{ticker}: {qty:.2f}sh @ ${avg_cost:.2f}, now ${price:.2f}, P&L ${pnl:.2f}")

    cursor = await conn.execute(
        "SELECT ticker FROM watchlist WHERE user_id = 'default'"
    )
    wl_rows = await cursor.fetchall()
    wl_parts = []
    for (ticker,) in wl_rows:
        price = price_cache.get_price(ticker)
        wl_parts.append(f"{ticker} (${price:.2f})" if price else ticker)

    total_value = cash + total_pos_value
    return (
        "You are FinAlly, an AI trading assistant. Be concise and data-driven.\n\n"
        f"Portfolio Context:\n"
        f"- Cash: ${cash:.2f}\n"
        f"- Total Value: ${total_value:.2f}\n"
        f"- Positions: {'; '.join(pos_parts) or 'none'}\n"
        f"- Watchlist: {', '.join(wl_parts) or 'none'}\n\n"
        "You can execute trades (buy/sell) and manage the watchlist.\n"
        'Always respond with valid JSON: {"message": "...", "trades": [...], "watchlist_changes": [...]}'
    )


async def _execute_actions(
    llm_resp: LLMResponse,
    user_message: str,
    price_cache: PriceCache,
    conn: aiosqlite.Connection,
) -> ChatResponse:
    """Execute trades and watchlist changes; collect errors instead of raising."""
    # AC3: execute trades
    trade_results: list[dict] = []
    for trade in llm_resp.trades:
        price = price_cache.get_price(trade.ticker)
        if price is None:
            trade_results.append(
                {"ticker": trade.ticker, "status": "error", "error": "Price unavailable"}
            )
            continue
        try:
            await execute_trade(conn, trade.ticker, trade.quantity, trade.side, price)
            trade_results.append(
                {"ticker": trade.ticker, "side": trade.side, "quantity": trade.quantity, "status": "executed"}
            )
        except HTTPException as e:
            detail = e.detail if isinstance(e.detail, dict) else {"error": str(e.detail)}
            trade_results.append(
                {"ticker": trade.ticker, "status": "error", "error": detail.get("error", str(e.detail))}
            )
        except Exception as e:
            trade_results.append(
                {"ticker": trade.ticker, "status": "error", "error": str(e)}
            )

    # AC5: execute watchlist changes
    watchlist_results: list[dict] = []
    for change in llm_resp.watchlist_changes:
        ticker_upper = change.ticker.upper()
        if change.action == "add":
            try:
                now = datetime.now(timezone.utc).isoformat()
                await conn.execute(
                    "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, 'default', ?, ?)",
                    (str(uuid.uuid4()), ticker_upper, now),
                )
                await conn.commit()
                watchlist_results.append({"ticker": ticker_upper, "status": "added"})
            except aiosqlite.IntegrityError:
                watchlist_results.append({"ticker": ticker_upper, "status": "already_exists"})
        elif change.action == "remove":
            cursor = await conn.execute(
                "DELETE FROM watchlist WHERE user_id = 'default' AND ticker = ?",
                (ticker_upper,),
            )
            await conn.commit()
            status = "removed" if cursor.rowcount > 0 else "not_found"
            watchlist_results.append({"ticker": ticker_upper, "status": status})

    # AC4: persist messages
    await save_message(conn, "user", user_message)
    actions = (
        {"trades": trade_results, "watchlist_changes": watchlist_results}
        if (trade_results or watchlist_results)
        else None
    )
    await save_message(conn, "assistant", llm_resp.message, actions)

    return ChatResponse(
        message=llm_resp.message,
        trades_executed=trade_results,
        watchlist_changes_applied=watchlist_results,
    )
