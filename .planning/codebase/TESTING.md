# Testing Patterns

_Last updated: 2026-04-09_
_Focus: quality_

## Summary

Backend uses pytest for unit and integration tests with strong coverage of the market data subsystem. 73 tests across models, cache, simulator, and API client. Frontend is not yet initialized. E2E testing infrastructure (Playwright) is planned but not yet implemented. Test configuration and fixtures support async testing.

## Test Framework

**Runner:**
- Framework: pytest 9.0.2+
- Config file: `backend/pyproject.toml`
- Location: `backend/tests/`

**Assertion library:**
- Python's built-in `assert` statements
- Pytest's implicit assertion rewriting

**Async support:**
- Plugin: `pytest-asyncio` 1.3.0+
- Decorator: `@pytest.mark.asyncio` on async test classes/methods
- Config:
  ```toml
  [tool.pytest.ini_options]
  testpaths = ["tests"]
  python_files = ["test_*.py"]
  python_classes = ["Test*"]
  python_functions = ["test_*"]
  asyncio_mode = "auto"
  asyncio_default_fixture_loop_scope = "function"
  ```

**Coverage:**
- Tool: pytest-cov 7.0.0+
- Config in `pyproject.toml`:
  ```toml
  [tool.coverage.run]
  source = ["app"]
  omit = ["tests/*"]
  
  [tool.coverage.report]
  exclude_lines = [
      "pragma: no cover",
      "def __repr__",
      "raise AssertionError",
      "raise NotImplementedError",
      "if __name__ == .__main__.:",
      "if TYPE_CHECKING:",
  ]
  ```

**Run commands:**
```bash
# All tests
uv run pytest -v

# Watch mode
# (not explicitly configured, but pytest supports --looponfail)

# Coverage
uv run pytest --cov=app --cov-report=html
# Generates htmlcov/index.html

# Specific test file
uv run pytest tests/market/test_simulator.py -v

# List tests without running
uv run pytest --co -q
```

## Test File Organization

**Location:** `backend/tests/`

**Structure:**
```
backend/tests/
├── __init__.py
├── conftest.py
├── market/
│   ├── __init__.py
│   ├── test_cache.py
│   ├── test_factory.py
│   ├── test_massive.py
│   ├── test_models.py
│   ├── test_simulator.py
│   └── test_simulator_source.py
```

**Naming:**
- Files: `test_*.py` (matches `python_files` pattern in config)
- Classes: `Test*` (matches `python_classes` pattern)
- Methods: `test_*` (matches `python_functions` pattern)
- Example: `tests/market/test_cache.py` → class `TestPriceCache` → method `test_update_and_get()`

**Pattern: co-located with source**
- Test file mirrors source: `app/market/cache.py` ↔ `tests/market/test_cache.py`
- Same module structure for clear navigation

## Test Structure

**Test class organization:**
```python
class TestPriceCache:
    """Unit tests for the PriceCache."""

    def test_update_and_get(self):
        """Test updating and getting a price."""
        cache = PriceCache()
        update = cache.update("AAPL", 190.50)
        assert update.ticker == "AAPL"
        assert update.price == 190.50
        assert cache.get("AAPL") == update
```

**Async test class:**
```python
@pytest.mark.asyncio
class TestSimulatorDataSource:
    """Integration tests for the SimulatorDataSource."""

    async def test_start_populates_cache(self):
        """Test that start() immediately populates the cache."""
        cache = PriceCache()
        source = SimulatorDataSource(price_cache=cache, update_interval=0.1)
        await source.start(["AAPL", "GOOGL"])
        
        assert cache.get("AAPL") is not None
        assert cache.get("GOOGL") is not None
        
        await source.stop()
```

**Key patterns:**
- Setup inline in test method (no setUp/tearDown) — prefer explicit setup
- Descriptive test method names that state what is being tested
- One logical assertion group per test (though multiple assertions allowed)
- Docstrings on all test methods explaining purpose
- Cleanup (e.g., `await source.stop()`) called explicitly at end

## Fixtures

**Fixtures defined:**
- `conftest.py` minimal — mainly for pytest config
- No custom fixtures currently; tests create objects directly
- Simple approach: cache and source objects instantiated in each test

**Pytest fixtures used:**
- `@pytest.fixture` implicit with asyncio for event loop management
- Event loop scope: `function` (fresh loop per test)

## Mocking

**Mocking approach:** Minimal use of mocks; prefer real dependencies

**When mocks are used:**
- Not extensively demonstrated in current tests
- Tests prefer creating real objects and inspecting behavior
- Example: `TestSimulatorDataSource` creates real `PriceCache` and `SimulatorDataSource` instances

**What is NOT mocked:**
- `PriceCache` — used as-is in simulator tests
- `GBMSimulator` — real math, real random numbers
- Time — uses actual asyncio.sleep() for timing tests

## Test Types & Coverage

### Unit Tests

**Market Models (`test_models.py`):**
- `PriceUpdate` creation and immutability
- Computed properties: `change`, `change_percent`, `direction`
- Serialization: `to_dict()`
- 12 tests covering all property logic and edge cases (e.g., zero previous price)

**Cache (`test_cache.py`):**
- Basic CRUD: `update()`, `get()`, `remove()`
- First-update behavior (flat direction, matching previous_price)
- Direction detection (up/down/flat)
- Price rounding to 2 decimals
- Version counter increments
- `__len__`, `__contains__` magic methods
- Thread safety (not tested explicitly, but used in production)
- 14 tests total

**Simulator (`test_simulator.py`):**
- GBM math correctness: prices always positive (exp never negative)
- Initial prices match seed values
- Ticker add/remove and duplicate handling
- Price movement over time (drift and diffusion)
- Cholesky decomposition for correlation
- Pairwise correlation values for different sectors
- Unknown tickers get random prices (50-300 range)
- Price rounding
- 18 tests

**Factory (`test_factory.py`):**
- Source selection based on environment variable
- Correct instantiation of SimulatorDataSource
- Environment-driven behavior

**Massive Client (`test_massive.py`):**
- REST API response parsing
- Rate limiting per tier
- Graceful handling of missing tickers in API response

### Integration Tests

**SimulatorDataSource (`test_simulator_source.py`):**
- `start()` populates cache immediately with seed prices
- Background loop updates cache over time
- Version counter increments with updates
- `add_ticker()` adds to active set and cache
- `remove_ticker()` removes from both
- `stop()` is clean and idempotent (safe to call multiple times)
- Exception resilience: loop continues after errors
- Custom update intervals work
- Custom event probability works
- Empty start (no tickers) is valid
- 10 tests, all async

**Pattern: realistic lifecycle**
```python
async def test_stop_is_clean(self):
    cache = PriceCache()
    source = SimulatorDataSource(price_cache=cache, update_interval=0.1)
    await source.start(["AAPL"])
    await source.stop()
    await source.stop()  # Double stop should not raise
```

### E2E Tests

**Status:** Not yet implemented

**Planned infrastructure (from PLAN.md):**
- Playwright browser automation
- Separate `docker-compose.test.yml` in `test/`
- Environment: `LLM_MOCK=true` for determinism
- Key scenarios to test:
  - Fresh start, default watchlist visible
  - Buy/sell shares, portfolio updates
  - Price streaming and animations
  - Chat functionality (mocked LLM)
  - SSE reconnection resilience
- Will live in: `test/` directory (not yet populated)

## Test Coverage

**Current status:** Market data subsystem well-covered (~73 tests)

**Measured:**
```bash
uv run pytest --cov=app --cov-report=html
# Output includes: Coverage report per module
```

**Unmeasured (not yet written):**
- FastAPI endpoints (GET /api/stream/prices, etc.)
- Database schema and queries
- Portfolio calculations (trades, P&L, valuations)
- Chat with LLM integration
- Massive API client (tests exist but integration untested)
- Frontend (not started)

**Test count by module:**
```
tests/market/test_cache.py           : 14 tests
tests/market/test_factory.py         : 5 tests
tests/market/test_massive.py         : 3+ tests
tests/market/test_models.py          : 12+ tests
tests/market/test_simulator.py       : 18 tests
tests/market/test_simulator_source.py: 10+ tests
─────────────────────────────────────────────
TOTAL: 73 tests collected
```

## Async Testing Pattern

**Mark classes/methods with @pytest.mark.asyncio:**
```python
@pytest.mark.asyncio
class TestSimulatorDataSource:
    async def test_start_populates_cache(self):
        # Can use await, async/await syntax
        await source.start(["AAPL"])
```

**asyncio_mode = "auto"** in config means pytest-asyncio manages event loop lifecycle automatically.

**Cleanup pattern:**
```python
async def test_something(self):
    source = SimulatorDataSource(cache, update_interval=0.1)
    await source.start(["AAPL"])
    # Test assertions
    await source.stop()  # Always clean up
```

## Error Testing

**Pattern:** Verify exceptions and error conditions

**Example from `test_models.py`:**
```python
def test_immutability(self):
    """Test that PriceUpdate is immutable."""
    update = PriceUpdate(ticker="AAPL", price=190.50, previous_price=190.00, timestamp=1234567890.0)
    
    with pytest.raises(AttributeError):
        update.price = 200.00  # Should raise error
```

**Another example from `test_cache.py`:**
```python
def test_remove_nonexistent(self):
    """Test removing a ticker that doesn't exist."""
    cache = PriceCache()
    cache.remove("AAPL")  # Should not raise
```

## Timing Tests

**Pattern:** Use asyncio.sleep() for temporal behavior

**Example from `test_simulator_source.py`:**
```python
async def test_prices_update_over_time(self):
    cache = PriceCache()
    source = SimulatorDataSource(price_cache=cache, update_interval=0.05)
    await source.start(["AAPL"])
    
    initial_version = cache.version
    await asyncio.sleep(0.3)  # Several update cycles
    
    # Version should have incremented (prices updated)
    assert cache.version > initial_version
    
    await source.stop()
```

## Common Patterns

**Arrange-Act-Assert (AAA):**
```python
def test_direction_up(self):
    # Arrange
    cache = PriceCache()
    cache.update("AAPL", 190.00)
    
    # Act
    update = cache.update("AAPL", 191.00)
    
    # Assert
    assert update.direction == "up"
    assert update.change == 1.00
```

**Idempotency testing:**
```python
async def test_stop_is_clean(self):
    source = SimulatorDataSource(cache, update_interval=0.1)
    await source.start(["AAPL"])
    await source.stop()
    await source.stop()  # Should not raise
```

**Boundary value testing:**
```python
def test_change_percent_zero_previous(self):
    """Test percentage change with zero previous price."""
    update = PriceUpdate(ticker="AAPL", price=100.00, previous_price=0.00, timestamp=1234567890.0)
    assert update.change_percent == 0.0
```

## Coverage Gaps

**Not tested (high priority for future phases):**

1. **API Routes** (`app/api/` — not yet created)
   - GET /api/stream/prices (SSE endpoint)
   - POST /api/portfolio/trade
   - GET/POST /api/watchlist
   - POST /api/chat

2. **Database** (`app/db/` — not yet created)
   - Schema creation and migrations
   - Trade execution and position tracking
   - Portfolio valuation queries
   - Chat history persistence

3. **Portfolio Math** (not yet created)
   - Trade execution (sufficient cash/shares validation)
   - P&L calculations
   - Average cost tracking
   - Portfolio value snapshots

4. **LLM Integration** (not yet created)
   - Structured output parsing
   - Trade instruction validation
   - Error handling for API failures
   - LLM mock mode behavior

5. **Massive API Client** (tests exist but limited coverage)
   - Real API calls (blocked by network, requires key)
   - Rate limiting enforcement
   - Response parsing for edge cases

6. **Frontend** (not started)
   - Component rendering
   - State management
   - Event handling
   - SSE client integration

7. **E2E** (infrastructure not yet built)
   - Browser automation with Playwright
   - Full user workflows
   - Cross-browser compatibility

## How to Run Tests Locally

```bash
cd backend

# Install dev dependencies
uv sync --extra dev

# Run all tests
uv run pytest -v

# Run with coverage report
uv run pytest --cov=app --cov-report=html
# Open htmlcov/index.html in browser

# Run specific test
uv run pytest tests/market/test_simulator.py::TestGBMSimulator::test_prices_change_over_time -v

# Run with detailed output (show print statements)
uv run pytest -v -s

# Run linter
uv run ruff check app/ tests/

# Format code
uv run ruff format app/ tests/
```

## Future Testing Priorities

1. **API endpoint tests** — FastAPI TestClient for all /api/* routes
2. **Database tests** — SQLite operations and schema validation
3. **Integration tests** — Database + API endpoints together
4. **E2E tests** — Playwright with Docker container
5. **Frontend unit tests** — React Testing Library or Vitest
6. **Performance tests** — SSE throughput, cache concurrency

---

*Testing analysis: 2026-04-09*
