"""Factory for creating market data sources."""

from __future__ import annotations

import logging
import os

from .cache import PriceCache
from .interface import MarketDataSource
from .massive_client import MassiveDataSource
from .simulator import SimulatorDataSource

logger = logging.getLogger(__name__)


def has_massive_api_key() -> bool:
    """Return True if a Massive API key is configured."""
    return bool(os.environ.get("MASSIVE_API_KEY", "").strip())


def _parse_massive_config() -> tuple[float, float]:
    """Parse Massive polling config from environment."""
    raw_interval = os.environ.get("MASSIVE_POLL_INTERVAL_SECONDS", "0.5").strip()
    raw_stale_seconds = os.environ.get("MASSIVE_STALE_TRADE_SECONDS", "10").strip()
    try:
        poll_interval = float(raw_interval)
    except ValueError:
        poll_interval = 0.5
    try:
        stale_trade_seconds = float(raw_stale_seconds)
    except ValueError:
        stale_trade_seconds = 10.0
    if poll_interval <= 0:
        poll_interval = 0.5
    if stale_trade_seconds < 0:
        stale_trade_seconds = 10.0
    return poll_interval, stale_trade_seconds


def create_specific_source(
    source_type: str, price_cache: PriceCache
) -> MarketDataSource:
    """Create a specific market data source by type name.

    source_type: "massive" or "simulator"
    Raises ValueError if "massive" requested but no API key is set.
    """
    if source_type == "massive":
        api_key = os.environ.get("MASSIVE_API_KEY", "").strip()
        if not api_key:
            raise ValueError("MASSIVE_API_KEY is not configured")
        poll_interval, stale_trade_seconds = _parse_massive_config()
        logger.info("Creating Massive data source (explicit switch)")
        return MassiveDataSource(
            api_key=api_key,
            price_cache=price_cache,
            poll_interval=poll_interval,
            stale_trade_seconds=stale_trade_seconds,
        )
    else:
        logger.info("Creating Simulator data source (explicit switch)")
        return SimulatorDataSource(price_cache=price_cache)


def create_market_data_source(price_cache: PriceCache) -> MarketDataSource:
    """Create the appropriate market data source based on environment variables.

    - MASSIVE_API_KEY set and non-empty → MassiveDataSource (real market data)
    - Otherwise → SimulatorDataSource (GBM simulation)

    Returns an unstarted source. Caller must await source.start(tickers).
    """
    api_key = os.environ.get("MASSIVE_API_KEY", "").strip()

    if api_key:
        poll_interval, stale_trade_seconds = _parse_massive_config()
        logger.info("Market data source: Massive API (real data, %.3fs poll)", poll_interval)
        return MassiveDataSource(
            api_key=api_key,
            price_cache=price_cache,
            poll_interval=poll_interval,
            stale_trade_seconds=stale_trade_seconds,
        )
    else:
        logger.info("Market data source: GBM Simulator")
        return SimulatorDataSource(price_cache=price_cache)
