"""Trade execution service."""

import uuid
from datetime import datetime
import aiosqlite

from app.market import PriceCache


class TradeExecutionError(Exception):
    """Error executing a trade."""

    pass


async def execute_trade_service(
    db: aiosqlite.Connection,
    price_cache: PriceCache,
    ticker: str,
    quantity: float,
    side: str,
) -> dict:
    """Execute a trade (buy or sell) and update the database.

    Returns a dict with execution details: {success, message, ticker, quantity, side, price}
    Raises TradeExecutionError if validation fails.
    """
    if side not in ("buy", "sell"):
        raise TradeExecutionError(f"Invalid side: {side}. Must be 'buy' or 'sell'")

    ticker = ticker.upper()
    current_price = price_cache.get_price(ticker)

    if current_price is None:
        raise TradeExecutionError(f"Unknown ticker: {ticker}")

    if quantity <= 0:
        raise TradeExecutionError("Quantity must be positive")

    # Fetch user cash balance
    user = await db.execute(
        "SELECT cash_balance FROM users_profile WHERE user_id = 'default'"
    )
    user_row = await user.fetchone()
    cash_balance = user_row["cash_balance"] if user_row else 10000.0

    if side == "buy":
        cost = quantity * current_price
        if cost > cash_balance:
            raise TradeExecutionError(
                f"Insufficient cash. Need ${cost:.2f}, have ${cash_balance:.2f}"
            )

        # Update cash
        new_cash = cash_balance - cost
        await db.execute(
            "UPDATE users_profile SET cash_balance = ? WHERE user_id = 'default'",
            (new_cash,),
        )

        # Update or create position
        existing = await db.execute(
            "SELECT quantity, avg_cost FROM positions WHERE user_id = 'default' AND ticker = ?",
            (ticker,),
        )
        existing_row = await existing.fetchone()

        if existing_row:
            old_quantity = existing_row["quantity"]
            old_avg_cost = existing_row["avg_cost"]
            new_quantity = old_quantity + quantity
            new_avg_cost = (
                old_quantity * old_avg_cost + quantity * current_price
            ) / new_quantity

            await db.execute(
                "UPDATE positions SET quantity = ?, avg_cost = ?, updated_at = ? "
                "WHERE user_id = 'default' AND ticker = ?",
                (new_quantity, new_avg_cost, datetime.utcnow().isoformat(), ticker),
            )
        else:
            await db.execute(
                "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) "
                "VALUES (?, 'default', ?, ?, ?, ?)",
                (
                    str(uuid.uuid4()),
                    ticker,
                    quantity,
                    current_price,
                    datetime.utcnow().isoformat(),
                ),
            )

    else:  # sell
        existing = await db.execute(
            "SELECT quantity FROM positions WHERE user_id = 'default' AND ticker = ?",
            (ticker,),
        )
        existing_row = await existing.fetchone()

        if not existing_row or existing_row["quantity"] < quantity:
            available = existing_row["quantity"] if existing_row else 0
            raise TradeExecutionError(
                f"Insufficient shares. Have {available}, trying to sell {quantity}"
            )

        # Update cash
        proceeds = quantity * current_price
        new_cash = cash_balance + proceeds
        await db.execute(
            "UPDATE users_profile SET cash_balance = ? WHERE user_id = 'default'",
            (new_cash,),
        )

        # Update position
        old_quantity = existing_row["quantity"]
        new_quantity = old_quantity - quantity

        if new_quantity > 0:
            await db.execute(
                "UPDATE positions SET quantity = ?, updated_at = ? "
                "WHERE user_id = 'default' AND ticker = ?",
                (new_quantity, datetime.utcnow().isoformat(), ticker),
            )
        else:
            # Delete position if quantity reaches zero
            await db.execute(
                "DELETE FROM positions WHERE user_id = 'default' AND ticker = ?",
                (ticker,),
            )

    # Record trade in history
    await db.execute(
        "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) "
        "VALUES (?, 'default', ?, ?, ?, ?, ?)",
        (
            str(uuid.uuid4()),
            ticker,
            side,
            quantity,
            current_price,
            datetime.utcnow().isoformat(),
        ),
    )

    await db.commit()

    return {
        "success": True,
        "message": f"Executed {side.upper()} {quantity} shares of {ticker} @ ${current_price:.2f}",
        "ticker": ticker,
        "quantity": quantity,
        "side": side,
        "price": current_price,
    }
