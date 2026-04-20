"""Chat service — LLM integration with portfolio context and action execution."""

import asyncio
import json
import logging
import os
import re
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


def _extract_json(text: str) -> dict:
    """Extract the first JSON object from text; raises ValueError if none found."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        return json.loads(match.group())
    raise ValueError(f"No valid JSON object found in: {text[:200]}")


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
    # Note: no response_format — reasoning models (nemotron, deepseek-r1) emit a
    # skeleton JSON in content when response_format is set; prompt-only + regex
    # extraction works reliably across the free-tier model pool.
    # asyncio.wait_for is used instead of litellm timeout= to ensure the underlying
    # httpx connection is properly cancelled (not left running in the background).
    raw = ""
    try:
        response = await asyncio.wait_for(
            litellm.acompletion(model="openrouter/openrouter/free", messages=messages),
            timeout=30,
        )
        raw = response.choices[0].message.content or ""
        parsed = _extract_json(raw)
        llm_resp = LLMResponse(**parsed)
    except asyncio.TimeoutError:
        logging.warning("LLM request timed out after 30s")
        raise HTTPException(
            status_code=503,
            detail={"error": "LLM request timed out", "code": "LLM_TIMEOUT"},
        )
    except (json.JSONDecodeError, ValueError):
        logging.warning(f"LLM parse error — using raw text as message: {raw[:200]}")
        note = "\n\n⚠️ The AI response was not in the expected format — no trades or watchlist changes were executed. Please try rephrasing your request."
        llm_resp = LLMResponse(message=raw + note, trades=[], watchlist_changes=[])
    except Exception as exc:
        logging.error(f"LLM error: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=503,
            detail={"error": "LLM request failed", "code": "LLM_ERROR"},
        ) from exc

    return await _execute_actions(llm_resp, message, price_cache, conn)


async def _build_system_prompt(price_cache: PriceCache, conn: aiosqlite.Connection) -> str:
    """Build system prompt injected with current portfolio state."""
    cursor = await conn.execute(
        "SELECT cash_balance FROM users_profile WHERE id = 'default'"
    )
    row = await cursor.fetchone()
    cash = row[0] if row else 0.0

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
        "Always respond with valid JSON matching this exact schema:\n"
        '{"message": "your response", "trades": [{"ticker": "SYMBOL", "side": "buy" or "sell", "quantity": NUMBER}], "watchlist_changes": [{"ticker": "SYMBOL", "action": "add" or "remove"}]}'
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
                {"ticker": trade.ticker, "side": trade.side, "quantity": trade.quantity, "status": "error", "error": "Price unavailable"}
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
                {"ticker": trade.ticker, "side": trade.side, "quantity": trade.quantity, "status": "error", "error": detail.get("error", str(e.detail))}
            )
        except Exception as e:
            trade_results.append(
                {"ticker": trade.ticker, "side": trade.side, "quantity": trade.quantity, "status": "error", "error": str(e)}
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
                watchlist_results.append({"ticker": ticker_upper, "action": "add", "status": "ok"})
            except aiosqlite.IntegrityError:
                watchlist_results.append({"ticker": ticker_upper, "action": "add", "status": "already_exists"})
        elif change.action == "remove":
            cursor = await conn.execute(
                "DELETE FROM watchlist WHERE user_id = 'default' AND ticker = ?",
                (ticker_upper,),
            )
            await conn.commit()
            status = "ok" if cursor.rowcount > 0 else "not_found"
            watchlist_results.append({"ticker": ticker_upper, "action": "remove", "status": status})

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
