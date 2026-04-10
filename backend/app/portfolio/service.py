"""Portfolio business logic: valuation, data retrieval, and atomic transaction setup."""

import sqlite3
from decimal import Decimal

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
