"""Factory for creating market data sources."""

from __future__ import annotations

import logging
import os

from .cache import PriceCache
from .interface import MarketDataSource
from .simulator import SimulatorDataSource

logger = logging.getLogger(__name__)


def create_market_data_source(price_cache: PriceCache) -> MarketDataSource:
    """Create the appropriate market data source based on environment variables.

    - MASSIVE_API_KEY set and non-empty → MassiveDataSource (real market data)
    - Otherwise → SimulatorDataSource (GBM simulation)

    Returns an unstarted source. Caller must await source.start(tickers).
    """
    api_key = os.environ.get("MASSIVE_API_KEY", "").strip()

    if api_key:
        logger.info("Market data source: Massive API (real data)")
        # Lazy import: only import MassiveDataSource if API key is configured
        try:
            from .massive_client import MassiveDataSource
            return MassiveDataSource(api_key=api_key, price_cache=price_cache)
        except ImportError as e:
            logger.warning(
                f"MASSIVE_API_KEY is set but MassiveDataSource unavailable: {e}. "
                "Falling back to simulator."
            )
            return SimulatorDataSource(price_cache=price_cache)
    else:
        logger.info("Market data source: GBM Simulator")
        return SimulatorDataSource(price_cache=price_cache)
