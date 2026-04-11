# Coding Conventions

_Last updated: 2026-04-09_
_Focus: quality_

## Summary

The FinAlly codebase follows modern Python conventions for the backend with emphasis on type hints, docstrings, and clear naming. The project uses Ruff for linting and formatting. Frontend is not yet initialized. Code is organized into domain modules with descriptive names and clear separation of concerns.

## Python Naming Patterns

**Modules and packages:**
- Snake_case for filenames: `cache.py`, `simulator.py`, `seed_prices.py`, `massive_client.py`
- Descriptive names that indicate purpose: `interface.py` for abstract contracts, `factory.py` for creation patterns, `models.py` for data structures

**Classes:**
- PascalCase: `PriceUpdate`, `PriceCache`, `MarketDataSource`, `GBMSimulator`, `SimulatorDataSource`, `MassiveDataSource`
- Concrete implementations inherit from abstract base or interface: `SimulatorDataSource(MarketDataSource)`
- Internal private attributes prefixed with underscore: `self._prices`, `self._lock`, `self._task`, `self._cholesky`

**Functions and methods:**
- Snake_case: `update()`, `get_price()`, `step()`, `get_tickers()`, `_pairwise_correlation()`, `_rebuild_cholesky()`
- Private methods prefixed with single underscore: `_add_ticker_internal()`, `_run_loop()`
- Properties use `@property` decorator: `direction`, `change`, `change_percent`, `version`
- Async methods named clearly with no special prefix: `async def start()`, `async def stop()`, `async def add_ticker()`

**Variables and parameters:**
- Snake_case for all variables: `ticker`, `price`, `previous_price`, `timestamp`, `cache`, `tickers`, `dt`, `event_probability`
- Descriptive names over abbreviations: `update_interval` not `ui`, `event_probability` not `prob`
- Loop variables stay short when obvious: `for i, ticker in enumerate(self._tickers)`, `for t1, t2 in pairs`

**Module-level constants:**
- UPPER_CASE with underscores: `SEED_PRICES`, `TICKER_PARAMS`, `DEFAULT_PARAMS`, `CORRELATION_GROUPS`, `TRADING_SECONDS_PER_YEAR`, `INTRA_TECH_CORR`, `CROSS_GROUP_CORR`
- Documented with type hints: `SEED_PRICES: dict[str, float]`

## Code Style

**Formatting:**
- Tool: Ruff (formatter + linter unified)
- Line length: 100 characters (`tool.ruff.line-length = 100` in `pyproject.toml`)
- Ignore: Line-too-long in linter (`ignore = ["E501"]`) because formatter handles wrapping

**Import organization:**
- Standard library first (implicit group)
- Third-party: `import numpy as np`, `from fastapi import ...`
- Local: `from .cache import PriceCache`, relative imports within package
- Organized by Ruff's "I" rule (import sorting)
- Example from `simulator.py`:
  ```python
  import asyncio
  import logging
  import math
  import random
  
  import numpy as np
  
  from .cache import PriceCache
  from .interface import MarketDataSource
  from .seed_prices import (...)
  ```

**Linting:**
- Tool: Ruff
- Rules enabled: `select = ["E", "F", "I", "N", "W"]`
  - E: PEP 8 errors
  - F: PyFlakes (undefined names, unused imports)
  - I: isort (import sorting)
  - N: pep8-naming (naming conventions)
  - W: Warnings
- Run: `uv run ruff check app/ tests/`
- Format: `uv run ruff format app/ tests/`

## Type Hints

**Required for all functions:**
- All parameters have explicit types (except `self`)
- Return type annotations on every function
- Examples:
  ```python
  def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
  async def start(self, tickers: list[str]) -> None:
  def get(self, ticker: str) -> PriceUpdate | None:
  ```

**Union types:**
- Use `|` syntax (Python 3.10+): `float | None`, `dict[str, float | None]`
- Not `Optional[]` or `Union[]`

**Collection types:**
- Always parameterized: `list[str]`, `dict[str, float]`, `set[str]`, not bare `list` or `dict`
- Generics from `typing` available but prefer built-in syntax

## Docstring Conventions

**Module docstrings:**
- Required at the top of every file
- One-line summary followed by optional details
- Example from `cache.py`:
  ```python
  """Thread-safe in-memory price cache."""
  ```

**Class docstrings:**
- Required, immediately after class declaration
- Describe purpose, lifecycle, and synchronization if relevant
- Example:
  ```python
  class PriceCache:
      """Thread-safe in-memory cache of the latest price for each ticker.
      
      Writers: SimulatorDataSource or MassiveDataSource (one at a time).
      Readers: SSE streaming endpoint, portfolio valuation, trade execution.
      """
  ```

**Method/function docstrings:**
- Required for public methods
- Format: one-line summary, then detailed description if complex
- Include parameters and return description for non-obvious cases
- Example from `cache.py`:
  ```python
  def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
      """Record a new price for a ticker. Returns the created PriceUpdate.
      
      Automatically computes direction and change from the previous price.
      If this is the first update for the ticker, previous_price == price (direction='flat').
      """
  ```

**Comments:**
- Minimal comments outside docstrings; code should be self-documenting
- Comment when explaining complex math or non-obvious logic
- Example from `simulator.py`:
  ```python
  # GBM: S(t+dt) = S(t) * exp((mu - 0.5*sigma^2)*dt + sigma*sqrt(dt)*Z)
  drift = (mu - 0.5 * sigma**2) * self._dt
  ```

## Immutability & Frozen Dataclasses

**PriceUpdate:**
- Uses `@dataclass(frozen=True, slots=True)` from `models.py`
- Immutable snapshot: once created, cannot be modified
- Immutability tested explicitly: `test_immutability` in `test_models.py` verifies `AttributeError` on assignment
- Prevents accidental mutations during concurrent access

**Pattern:**
```python
@dataclass(frozen=True, slots=True)
class PriceUpdate:
    """Immutable snapshot of a single ticker's price at a point in time."""
    ticker: str
    price: float
    previous_price: float
    timestamp: float = field(default_factory=time.time)
```

## Thread Safety

**Explicit locking with Lock:**
- Used in `PriceCache` to protect shared state
- All access to `self._prices` dict guarded with `with self._lock:`
- Example:
  ```python
  def get(self, ticker: str) -> PriceUpdate | None:
      with self._lock:
          return self._prices.get(ticker)
  ```

**Async tasks:**
- Background tasks created with `asyncio.create_task()` with explicit names: `asyncio.create_task(..., name="simulator-loop")`
- Cancellation handled gracefully with try/except `asyncio.CancelledError`

## Error Handling

**Strategy:** Minimal defensive code; let exceptions propagate when appropriate

**Patterns:**
- Silent no-ops for idempotent operations: `remove_ticker()` does nothing if ticker not present
- Validation on write: `update()` on prices assumes valid float input
- Logging on failure: `SimulatorDataSource._run_loop()` logs and continues on exception
  ```python
  except Exception:
      logger.exception("Simulator step failed")
  ```

**No broad exception catching except at boundaries:** The background loop catches all to prevent task death.

## Logging

**Framework:** Python's standard `logging` module

**Pattern:**
- One logger per module: `logger = logging.getLogger(__name__)`
- Located after imports in source file
- Example from `simulator.py`:
  ```python
  logger = logging.getLogger(__name__)
  ```

**Usage:**
- Info level for lifecycle events: `logger.info("Simulator started with %d tickers", len(tickers))`
- Debug for detailed flow: `logger.debug("Random event on %s: %.1f%%", ticker, shock_magnitude * 100)`
- Exception for caught errors: `logger.exception("Simulator step failed")`

## Module Structure

**Example: `app/market/`**

- `models.py` — Data structures (`PriceUpdate`)
- `interface.py` — Abstract contracts (`MarketDataSource`)
- `cache.py` — Concrete implementation of caching
- `simulator.py` — Concrete implementation of market data (GBM-based)
- `massive_client.py` — Concrete implementation of market data (Massive API)
- `factory.py` — Factory function to select implementation
- `stream.py` — SSE streaming router (FastAPI)
- `seed_prices.py` — Configuration data
- `__init__.py` — Public API exports

**Pattern:**
```python
# __init__.py
from .cache import PriceCache
from .factory import create_market_data_source
from .interface import MarketDataSource
from .models import PriceUpdate
from .stream import create_stream_router

__all__ = [
    "PriceUpdate",
    "PriceCache",
    "MarketDataSource",
    "create_market_data_source",
    "create_stream_router",
]
```

## Git Commit Conventions

**Observed pattern:**
- Format: `type: description` or `type(scope): description`
- Types seen: `feat:`, `chore:`, `fix:`, `docs:`
- Examples from recent commits:
  - `chore: adding gsd`
  - `chore: updating .gitignore`
  - `feat: implement complete market data backend`
  - `fix: all issues from market data code review`

**No specific length limits observed, but keep descriptions concise and imperative**

## API Request/Response Convention

(Frontend API contracts not yet established; see PLAN.md for endpoint specifications)

## Testing Conventions

(Detailed in TESTING.md)

---

*Analysis complete: 2026-04-09*
