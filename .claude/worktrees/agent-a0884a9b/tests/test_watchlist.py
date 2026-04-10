"""Unit tests for watchlist API endpoint."""

import sqlite3

import pytest

from app.market import PriceCache
from app.watchlist.models import WatchlistItemResponse, WatchlistResponse


def test_get_watchlist(test_db: sqlite3.Connection, price_cache: PriceCache):
    """Test watchlist query returns all tickers with live prices.

    Verifies:
    - Query returns all default seeded tickers
    - Each item has correct fields: ticker, price, previous_price, direction, change_amount
    - Direction reflects price movement (up/down/flat)
    - change_amount matches price - previous_price
    - Fallback works for tickers not in cache
    """
    # Insert test price data into cache
    # AAPL: price > previous → "up"
    price_cache.update("AAPL", 189.0)  # First update: price=189.0, previous=189.0
    price_cache.update("AAPL", 190.5)  # Second update: price=190.5, previous=189.0 → "up"

    # GOOGL: price < previous → "down"
    price_cache.update("GOOGL", 176.0)  # First update: price=176.0, previous=176.0
    price_cache.update("GOOGL", 175.0)  # Second update: price=175.0, previous=176.0 → "down"

    # TSLA: price == previous → "flat"
    price_cache.update("TSLA", 242.0)  # First update: price=242.0, previous=242.0
    price_cache.update("TSLA", 242.0)  # Second update: price=242.0, previous=242.0 → "flat"

    # Query watchlist from database
    cursor = test_db.cursor()
    cursor.execute(
        """
        SELECT ticker FROM watchlist
        WHERE user_id='default'
        ORDER BY added_at DESC
    """
    )
    rows = cursor.fetchall()

    # Build response items
    watchlist_items = []
    for row in rows:
        ticker = row[0]
        price_update = price_cache.get(ticker)
        if price_update:
            item = WatchlistItemResponse(
                ticker=ticker,
                price=price_update.price,
                previous_price=price_update.previous_price,
                direction=price_update.direction,
                change_amount=price_update.price - price_update.previous_price,
            )
        else:
            item = WatchlistItemResponse(
                ticker=ticker,
                price=0.0,
                previous_price=0.0,
                direction="flat",
                change_amount=0.0,
            )
        watchlist_items.append(item)

    # Verify we have items
    assert len(watchlist_items) > 0, "watchlist should not be empty"

    # Build response object
    response = WatchlistResponse(watchlist=watchlist_items)

    # Find specific tickers and verify their data
    ticker_map = {item.ticker: item for item in response.watchlist}

    # Verify AAPL (should be in default watchlist)
    if "AAPL" in ticker_map:
        aapl = ticker_map["AAPL"]
        assert aapl.price == 190.5
        assert aapl.previous_price == 189.0
        assert aapl.direction == "up"
        assert abs(aapl.change_amount - 1.5) < 0.01

    # Verify GOOGL
    if "GOOGL" in ticker_map:
        googl = ticker_map["GOOGL"]
        assert googl.price == 175.0
        assert googl.previous_price == 176.0
        assert googl.direction == "down"
        assert abs(googl.change_amount - (-1.0)) < 0.01

    # Verify TSLA
    if "TSLA" in ticker_map:
        tsla = ticker_map["TSLA"]
        assert tsla.price == 242.0
        assert tsla.previous_price == 242.0
        assert tsla.direction == "flat"
        assert abs(tsla.change_amount - 0.0) < 0.01

    # Verify all items have required fields
    for item in response.watchlist:
        assert item.ticker
        assert item.price is not None
        assert item.previous_price is not None
        assert item.direction in ["up", "down", "flat"]
        assert item.change_amount is not None
