"""LLM service for chat integration."""

import os
from datetime import datetime, timezone
import aiosqlite
from litellm import completion

from app.market import PriceCache
from .models import ChatResponse

MODEL = "openrouter/openrouter/free"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}


async def build_portfolio_context(db: aiosqlite.Connection, price_cache: PriceCache) -> str:
    """Build a text summary of portfolio state for the LLM system prompt."""
    # Fetch user profile (cash balance)
    cursor = await db.execute(
        "SELECT cash_balance FROM users_profile WHERE user_id = ?",
        ("default",)
    )
    user_row = await cursor.fetchone()
    cash_balance = user_row["cash_balance"] if user_row else 10000.0

    # Fetch positions with current prices
    cursor = await db.execute(
        """
        SELECT ticker, quantity, avg_cost FROM positions
        WHERE user_id = ? ORDER BY ticker
        """,
        ("default",)
    )
    positions_rows = await cursor.fetchall()

    positions_text = ""
    total_position_value = 0.0

    for row in positions_rows:
        ticker = row["ticker"]
        quantity = row["quantity"]
        avg_cost = row["avg_cost"]

        price_update = price_cache.get(ticker)
        current_price = price_update.price if price_update else avg_cost

        position_value = quantity * current_price
        cost_basis = quantity * avg_cost
        unrealized_pl = position_value - cost_basis
        pl_pct = (
            (unrealized_pl / cost_basis * 100) if cost_basis > 0 else 0.0
        )

        total_position_value += position_value

        positions_text += (
            f"  {ticker}: {quantity} shares @ ${current_price:.2f} "
            f"(avg cost ${avg_cost:.2f}, P&L ${unrealized_pl:+.2f} [{pl_pct:+.1f}%])\n"
        )

    if not positions_text:
        positions_text = "  (no positions)\n"

    # Fetch watchlist
    cursor = await db.execute(
        "SELECT ticker FROM watchlist WHERE user_id = ? ORDER BY ticker",
        ("default",)
    )
    watchlist_rows = await cursor.fetchall()
    watchlist_tickers = [row["ticker"] for row in watchlist_rows]
    watchlist_prices = ""

    for ticker in watchlist_tickers:
        price_update = price_cache.get(ticker)
        if price_update:
            watchlist_prices += (
                f"  {ticker}: ${price_update.price:.2f} "
                f"({price_update.change_percent:+.2f}%)\n"
            )

    total_portfolio_value = cash_balance + total_position_value

    context = f"""
Current Portfolio State:
  Cash Balance: ${cash_balance:,.2f}
  Total Position Value: ${total_position_value:,.2f}
  Total Portfolio Value: ${total_portfolio_value:,.2f}

Positions:
{positions_text}
Watchlist Prices:
{watchlist_prices if watchlist_prices else "  (no prices yet)"}
"""
    return context.strip()


async def call_llm(
    messages: list[dict],
    portfolio_context: str,
) -> ChatResponse:
    """Call LiteLLM with structured output."""
    # Build system prompt
    system_prompt = f"""You are FinAlly, an AI trading assistant for a simulated portfolio.
You help users analyze their positions, suggest trades, and manage their watchlist.

Be concise and data-driven. Always respond with valid JSON matching this exact schema:
{{
  "message": "<your conversational response>",
  "trades": [{{"ticker": "AAPL", "side": "buy", "quantity": 10}}],
  "watchlist_changes": [{{"ticker": "PYPL", "action": "add"}}]
}}
Both "trades" and "watchlist_changes" may be empty arrays. Never omit any field.

{portfolio_context}"""

    # Prepare messages
    full_messages = [{"role": "system", "content": system_prompt}] + messages

    # Call LiteLLM with JSON mode (compatible with openrouter/free routing)
    try:
        response = completion(
            model=MODEL,
            messages=full_messages,
            extra_body=EXTRA_BODY,
        )

        # Extract and parse the response
        result_json = response.choices[0].message.content or ""
        result = ChatResponse.model_validate_json(result_json)
        return result

    except Exception as e:
        # Fallback to a default response if LLM call fails
        return ChatResponse(
            message=f"I encountered an error processing your request: {str(e)}",
            trades=[],
            watchlist_changes=[],
        )
