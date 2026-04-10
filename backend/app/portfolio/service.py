"""Portfolio business logic: valuation, data retrieval, and atomic transaction setup."""

import sqlite3
import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool

from app.market import PriceCache


def compute_portfolio_value(
    cursor: sqlite3.Cursor, price_cache: PriceCache
) -> Decimal:
    """Compute total portfolio value (cash + stock positions).

    Args:
        cursor: SQLite cursor with active connection
        price_cache: PriceCache instance for live prices

    Returns:
        Decimal: Total portfolio value (cash + sum of position values)

    All monetary values initialized from strings (Decimal("value")) to avoid
    float precision errors. Intermediate calculations stay in Decimal.
    """
    # Fetch cash balance from users_profile
    cursor.execute("SELECT cash_balance FROM users_profile WHERE id='default'")
    row = cursor.fetchone()
    if row is None:
        return Decimal("0")

    cash_balance = Decimal(str(row[0]))

    # Fetch all positions for this user
    cursor.execute(
        """
        SELECT ticker, quantity, avg_cost FROM positions
        WHERE user_id='default' AND quantity > 0
    """
    )
    positions = cursor.fetchall()

    # Sum position values at current prices
    stock_value = Decimal("0")
    for ticker, quantity, avg_cost in positions:
        price_update = price_cache.get(ticker)
        if price_update is None:
            continue

        # All Decimal conversions from string
        qty_decimal = Decimal(str(quantity))
        current_price_decimal = Decimal(str(price_update.price))

        position_value = qty_decimal * current_price_decimal
        stock_value += position_value

    return cash_balance + stock_value


def get_portfolio_data(
    cursor: sqlite3.Cursor, price_cache: PriceCache
) -> dict:
    """Fetch portfolio data and calculate P&L.

    Args:
        cursor: SQLite cursor with active connection
        price_cache: PriceCache instance for live prices

    Returns:
        dict with keys:
            - cash_balance (float): User's available cash
            - positions (list): Dicts with ticker, quantity, avg_cost, current_price,
                              unrealized_pnl (all floats), change_percent
            - total_value (float): Total portfolio value

    All Decimal calculations happen here; floats returned for JSON serialization.
    """
    # Fetch cash balance
    cursor.execute("SELECT cash_balance FROM users_profile WHERE id='default'")
    row = cursor.fetchone()
    if row is None:
        cash_balance = Decimal("0")
    else:
        cash_balance = Decimal(str(row[0]))

    # Fetch all positions
    cursor.execute(
        """
        SELECT ticker, quantity, avg_cost FROM positions
        WHERE user_id='default' AND quantity > 0
    """
    )
    positions_rows = cursor.fetchall()

    # Build positions list with live prices and P&L
    positions_list = []
    for ticker, quantity, avg_cost in positions_rows:
        price_update = price_cache.get(ticker)
        if price_update is None:
            continue

        # Convert to Decimal for calculation
        qty_decimal = Decimal(str(quantity))
        avg_cost_decimal = Decimal(str(avg_cost))
        current_price_decimal = Decimal(str(price_update.price))

        # Calculate unrealized P&L
        unrealized_pnl = (current_price_decimal - avg_cost_decimal) * qty_decimal

        # Convert to float for JSON
        positions_list.append(
            {
                "ticker": ticker,
                "quantity": float(quantity),
                "avg_cost": float(avg_cost_decimal),
                "current_price": float(current_price_decimal),
                "unrealized_pnl": float(unrealized_pnl),
                "change_percent": price_update.change_percent,
            }
        )

    # Compute total value
    total_value = compute_portfolio_value(cursor, price_cache)

    return {
        "cash_balance": float(cash_balance),
        "positions": positions_list,
        "total_value": float(total_value),
    }


def validate_trade_setup(
    db: sqlite3.Connection, ticker: str, side: str, quantity: Decimal, price_cache: PriceCache
) -> tuple[bool, str]:
    """Validate trade request before execution.

    Args:
        db: SQLite database connection
        ticker: Ticker symbol to trade
        side: "buy" or "sell"
        quantity: Number of shares to trade
        price_cache: PriceCache for current prices

    Returns:
        tuple[bool, str]: (is_valid, error_message)
            If valid: (True, "")
            If invalid: (False, reason)

    This function validates without writing to the database. Actual execution
    happens in the trade endpoint (Phase 2).
    """
    # Validate ticker format
    if not ticker or not isinstance(ticker, str):
        return (False, "Invalid ticker format")
    ticker = ticker.upper()
    if not (1 <= len(ticker) <= 5) or not ticker.isalnum():
        return (False, f"Ticker must be 1-5 alphanumeric characters, got {ticker}")

    # Validate side
    side_lower = side.lower()
    if side_lower not in ("buy", "sell"):
        return (False, "Side must be 'buy' or 'sell'")

    # Validate quantity
    if quantity <= 0:
        return (False, "Quantity must be greater than 0")

    # Get current price from cache
    price_update = price_cache.get(ticker)
    if price_update is None:
        return (False, f"No price available for {ticker}")

    current_price = Decimal(str(price_update.price))
    quantity_decimal = Decimal(str(quantity))

    # Validate buy: sufficient cash
    if side_lower == "buy":
        cursor = db.cursor()
        cursor.execute("SELECT cash_balance FROM users_profile WHERE id='default'")
        row = cursor.fetchone()
        if row is None:
            return (False, "User profile not found")

        cash_balance = Decimal(str(row[0]))
        required_cash = quantity_decimal * current_price

        if required_cash > cash_balance:
            return (False, f"Insufficient cash: need {float(required_cash)}, have {float(cash_balance)}")

    # Validate sell: sufficient shares
    elif side_lower == "sell":
        cursor = db.cursor()
        cursor.execute(
            """
            SELECT quantity FROM positions
            WHERE user_id='default' AND ticker=? AND quantity > 0
        """,
            (ticker,),
        )
        row = cursor.fetchone()
        current_quantity = Decimal(str(row[0])) if row else Decimal("0")

        if quantity_decimal > current_quantity:
            return (False, f"Insufficient shares: need {float(quantity_decimal)}, have {float(current_quantity)}")

    return (True, "")


async def execute_trade(
    db: sqlite3.Connection,
    ticker: str,
    side: str,
    quantity: Decimal,
    price_cache: PriceCache,
) -> dict:
    """Execute a trade atomically: validate, update positions, record snapshot.

    Entire flow is wrapped in BEGIN IMMEDIATE transaction:
    1. Pre-validate against cache (fresh prices, no lock held)
    2. Fetch current price from cache
    3. Begin immediate transaction (acquire write lock early)
    4. Re-validate inside transaction (in case price changed)
    5. Update cash balance
    6. Upsert position (buy: recalculate avg_cost if exists; sell: reduce qty or delete)
    7. Append trade log entry
    8. Record portfolio snapshot (within same transaction)
    9. Commit

    On any error: rollback entire transaction.

    Args:
        db: SQLite database connection
        ticker: Ticker symbol (should be uppercase, alphanumeric)
        side: "buy" or "sell" (should be lowercase)
        quantity: Number of shares (Decimal, > 0)
        price_cache: PriceCache for live prices

    Returns:
        dict with keys:
            - success: True if trade executed
            - ticker: Ticker symbol
            - side: "buy" or "sell"
            - quantity: float(quantity_decimal)
            - price: float(current_price)
            - new_balance: float(new_cash)
            - executed_at: ISO timestamp string

    Raises:
        HTTPException: 400 for validation failures, 500 for system errors
    """

    async def _execute_sync():
        # Pre-validate against cache (fresh prices, no lock held)
        is_valid, error_msg = validate_trade_setup(db, ticker, side, quantity, price_cache)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

        # Fetch current price fresh from cache
        current_price_update = price_cache.get(ticker)
        if not current_price_update:
            raise HTTPException(status_code=400, detail=f"No price for {ticker}")

        current_price = Decimal(str(current_price_update.price))

        cursor = db.cursor()

        try:
            # Begin immediate: acquire write lock early to prevent phantom reads
            cursor.execute("BEGIN IMMEDIATE")

            # Step 1: Fetch current state (fresh from DB, now locked)
            cursor.execute("SELECT cash_balance FROM users_profile WHERE id='default'")
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=500, detail="User profile not found")

            cash_balance = Decimal(str(row[0]))

            cursor.execute(
                """SELECT quantity, avg_cost FROM positions
                   WHERE user_id='default' AND ticker=? AND quantity > 0""",
                (ticker,),
            )
            pos_row = cursor.fetchone()
            current_qty = Decimal(str(pos_row[0])) if pos_row else Decimal("0")
            avg_cost = Decimal(str(pos_row[1])) if pos_row else Decimal("0")

            # Step 2: Validate inside transaction (redundant check for safety)
            quantity_decimal = Decimal(str(quantity))

            if side.lower() == "buy":
                cost = quantity_decimal * current_price
                if cost > cash_balance:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient cash: need {float(cost)}, have {float(cash_balance)}",
                    )
            elif side.lower() == "sell":
                if quantity_decimal > current_qty:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient shares: need {float(quantity_decimal)}, have {float(current_qty)}",
                    )

            # Step 3: Execute trade
            if side.lower() == "buy":
                # Calculate new cash
                new_cash = cash_balance - (quantity_decimal * current_price)

                # Update users_profile
                cursor.execute(
                    "UPDATE users_profile SET cash_balance=? WHERE id='default'",
                    (str(new_cash),),
                )

                # Upsert position
                if current_qty > 0:
                    # Position exists: update with weighted average cost
                    new_qty = current_qty + quantity_decimal
                    new_avg_cost = (current_qty * avg_cost + quantity_decimal * current_price) / new_qty
                    cursor.execute(
                        """UPDATE positions SET quantity=?, avg_cost=?, updated_at=datetime('now')
                           WHERE user_id='default' AND ticker=?""",
                        (str(new_qty), str(new_avg_cost), ticker),
                    )
                else:
                    # Position doesn't exist: insert new position
                    position_id = str(uuid.uuid4())
                    cursor.execute(
                        """INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
                           VALUES (?, 'default', ?, ?, ?, datetime('now'))""",
                        (position_id, ticker, str(quantity_decimal), str(current_price)),
                    )

            elif side.lower() == "sell":
                # Calculate new cash
                new_cash = cash_balance + (quantity_decimal * current_price)

                # Update users_profile
                cursor.execute(
                    "UPDATE users_profile SET cash_balance=? WHERE id='default'",
                    (str(new_cash),),
                )

                # Upsert position
                new_qty = current_qty - quantity_decimal
                if new_qty > 0:
                    # Position still has shares: update quantity
                    cursor.execute(
                        """UPDATE positions SET quantity=?, updated_at=datetime('now')
                           WHERE user_id='default' AND ticker=?""",
                        (str(new_qty), ticker),
                    )
                else:
                    # Sell-to-zero: delete position (per Pitfall 5)
                    cursor.execute(
                        "DELETE FROM positions WHERE user_id='default' AND ticker=?",
                        (ticker,),
                    )

            # Step 4: Record trade log entry (immutable audit trail)
            trade_id = str(uuid.uuid4())
            executed_at = datetime.utcnow().isoformat()
            cursor.execute(
                """INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at)
                   VALUES (?, 'default', ?, ?, ?, ?, ?)""",
                (trade_id, ticker, side.lower(), str(quantity_decimal), str(current_price), executed_at),
            )

            # Step 5: Record portfolio snapshot (immediately post-trade, same transaction)
            snapshot_id = str(uuid.uuid4())
            total_value = compute_portfolio_value(cursor, price_cache)
            recorded_at = datetime.utcnow().isoformat()
            cursor.execute(
                """INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at)
                   VALUES (?, 'default', ?, ?)""",
                (snapshot_id, str(total_value), recorded_at),
            )

            # Step 6: Commit transaction
            db.commit()

            # Return success response
            return {
                "success": True,
                "ticker": ticker,
                "side": side.lower(),
                "quantity": float(quantity_decimal),
                "price": float(current_price),
                "new_balance": float(new_cash),
                "executed_at": executed_at,
            }

        except HTTPException:
            # Re-raise HTTP exceptions (from validation)
            db.rollback()
            raise
        except Exception as e:
            # Rollback on any other error
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    return await run_in_threadpool(_execute_sync)
