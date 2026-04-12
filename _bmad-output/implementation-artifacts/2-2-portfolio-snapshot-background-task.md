# Story 2.2: Portfolio Snapshot Background Task

Status: done

## Story

As a **user tracking portfolio performance**,
I want **my portfolio value recorded automatically over time**,
so that **the P&L chart shows meaningful history even without trading**.

## Acceptance Criteria

1. **Given** the app starts, **when** the `lifespan` context manager initializes, **then** a portfolio snapshot background task starts alongside the market data task.
2. **Given** the snapshot task is running, **when** 30 seconds elapse, **then** a new row is inserted into `portfolio_snapshots` with `total_value` computed as `cash + sum(position.quantity * PriceCache.get_price(ticker))` for all positions.
3. **Given** the snapshot task is running, **when** it executes, **then** it does not block or delay any API responses (NFR5 — runs as a background async loop, not in request path).
4. **Given** `GET /api/portfolio/history` is called immediately after a fresh install with no trades, **then** it returns an empty array (no snapshots until first snapshot interval or trade).
5. **Given** a trade executes via `POST /api/portfolio/trade`, **when** the trade handler runs, **then** a snapshot is also recorded inline (in addition to the 30-second background task). *(Already implemented in Story 2.1 — verify it still works.)*

## Tasks / Subtasks

- [x] Task 1: Create `backend/app/snapshots.py` — the snapshot background task module (AC: 1, 2, 3)
  - [x] 1.1 Create `backend/app/snapshots.py` with an async function `snapshot_loop(price_cache: PriceCache, interval: float = 30.0)` that loops forever: sleep `interval` seconds, then compute and insert a snapshot
  - [x] 1.2 Snapshot value computation: open a DB connection via `get_db()`, read `cash_balance` + all positions, compute `total_value = cash + sum(qty * PriceCache.get_price(ticker))` for each position. If `get_price` returns `None` for a ticker, fall back to `avg_cost`.
  - [x] 1.3 Use `asyncio.CancelledError` handling: catch it to exit cleanly when the lifespan shuts down
  - [x] 1.4 Write unit tests for `snapshot_loop` in `backend/tests/test_snapshots.py`:
    - Test that after one interval, a snapshot row is inserted with correct `total_value`
    - Test that snapshot uses live prices from PriceCache (not avg_cost) when available
    - Test fallback to `avg_cost` when PriceCache has no price for a ticker
    - Test that the loop is cancellable (does not hang on shutdown)

- [x] Task 2: Wire snapshot task into `lifespan` in `backend/app/main.py` (AC: 1, 3)
  - [x] 2.1 In `lifespan()`, after `market_source.start(tickers)`, create the snapshot task via `asyncio.create_task(snapshot_loop(price_cache))`
  - [x] 2.2 In the shutdown phase (after `yield`), cancel the snapshot task and `await` it (with `CancelledError` suppression)
  - [x] 2.3 Write an integration test verifying the lifespan starts and stops the snapshot task without errors

- [x] Task 3: Verify AC 4 and AC 5 — existing behavior (AC: 4, 5)
  - [x] 3.1 Write (or confirm existing) test: `GET /api/portfolio/history` on a fresh DB returns `[]`
  - [x] 3.2 Confirm existing Story 2.1 trade tests verify that a snapshot is recorded inline after trade execution (already covered by `test_portfolio_service.py` and `test_portfolio_api.py`)

- [x] Task 4: Full regression test run
  - [x] 4.1 Run ALL tests (`uv run --extra dev pytest -v`) — existing + new must pass 100%

### Review Findings

- [x] [Review][Defer] No error handling for DB failures in snapshot_loop [backend/app/snapshots.py:12-25] — deferred, MVP scope; spec pattern only catches CancelledError
- [x] [Review][Defer] Floating-point accumulation in portfolio value sum [backend/app/snapshots.py:18-22] — deferred, pre-existing (F2 from Story 2.1)

## Dev Notes

### Architecture Compliance

**File location**: `backend/app/snapshots.py` — architecture specifies this as a top-level module under `app/`, NOT inside `portfolio/`. See architecture doc: `│   │   └── snapshots.py  # 30s portfolio snapshot background task`.

**Lifespan pattern (ARCH-6)**: Use FastAPI `lifespan` async context manager for all background tasks. Never use per-request `BackgroundTasks` for long-running loops. The current `lifespan` already starts market data — add the snapshot task alongside it.

**Snapshot timing (ARCH-16)**: Two recording paths:
1. Every 30 seconds via background task *(this story)*
2. Immediately after each trade execution *(already done in Story 2.1 `execute_trade()`)*

### Implementation Pattern

```python
# backend/app/snapshots.py
import asyncio
from app.db.connection import get_db
from app.market import PriceCache
from app.portfolio import db as portfolio_db

async def snapshot_loop(price_cache: PriceCache, interval: float = 30.0) -> None:
    """Record portfolio value every `interval` seconds."""
    try:
        while True:
            await asyncio.sleep(interval)
            async with get_db() as conn:
                cash = await portfolio_db.get_cash_balance(conn)
                positions = await portfolio_db.get_positions(conn)
                total_value = cash + sum(
                    (price_cache.get_price(p["ticker"]) or p["avg_cost"]) * p["quantity"]
                    for p in positions
                )
                await portfolio_db.insert_snapshot(conn, total_value)
    except asyncio.CancelledError:
        return
```

### Lifespan Wiring Pattern

```python
# In backend/app/main.py lifespan()
import asyncio
from app.snapshots import snapshot_loop

# After market_source.start(tickers):
snapshot_task = asyncio.create_task(snapshot_loop(price_cache))

yield  # app is running

# Shutdown:
snapshot_task.cancel()
try:
    await snapshot_task
except asyncio.CancelledError:
    pass
await market_source.stop()
```

### Existing Code to Reuse (DO NOT reinvent)

- `app.portfolio.db.get_cash_balance(conn)` — reads cash from `users_profile`
- `app.portfolio.db.get_positions(conn)` — returns `[{"ticker", "quantity", "avg_cost"}]`
- `app.portfolio.db.insert_snapshot(conn, total_value)` — inserts into `portfolio_snapshots`
- `app.db.connection.get_db()` — async context manager yielding aiosqlite connection
- `price_cache.get_price(ticker)` — returns `float | None`

### Testing Pattern (from Story 2.1)

- Use `pytest-asyncio` with `asyncio_mode = "auto"`
- Monkeypatch `app.db.config.DB_PATH` to a temp file (single target)
- Call `init_db()` in test setup to create schema + seed data
- For integration tests: `ASGITransport` + `AsyncClient`
- For the snapshot loop test: use a short interval (e.g., 0.1s), run loop as a task, sleep briefly, cancel, then verify snapshot rows exist

### Deferred Item from Story 2.1 Review

- **F2**: No rounding on `total_value` in snapshot (floating-point accumulation). This was deferred to this story. **Decision**: Leave as-is for MVP. Floating-point precision is acceptable for a simulated portfolio. Rounding would add complexity with no user-visible benefit.

### Project Structure Notes

- `backend/app/snapshots.py` does NOT exist yet — create it
- `backend/app/main.py` needs the snapshot task added to `lifespan()` — already has market data task
- `backend/tests/test_snapshots.py` does NOT exist yet — create it
- All existing modules remain untouched except `main.py` (lifespan modification only)

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 2.2 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/architecture.md — ARCH-6 lifespan, ARCH-16 snapshot timing, file tree showing snapshots.py location]
- [Source: _bmad-output/implementation-artifacts/2-1-portfolio-api-trade-execution.md — previous story intelligence, inline snapshot already implemented]
- [Source: PLAN.md — Section 7 Database schema, Section 6 Market Data]
- [Source: backend/app/main.py — current lifespan implementation]
- [Source: backend/app/portfolio/db.py — reusable DB functions]
- [Source: backend/app/portfolio/service.py — inline snapshot in execute_trade()]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
None — all tests passed on first run.

### Completion Notes List
- Created `backend/app/snapshots.py` with `snapshot_loop()` — sleep-first async loop that computes `total_value = cash + sum(price * qty)` with PriceCache fallback to avg_cost
- Wired snapshot task into `main.py` lifespan — `asyncio.create_task()` on startup, cancel + await on shutdown
- 5 new tests in `test_snapshots.py`: 4 unit tests for snapshot_loop + 1 integration test for lifespan wiring
- AC 4 and AC 5 already covered by existing `test_portfolio_api.py` tests from Story 2.1
- F2 (floating-point rounding) deferred — acceptable for MVP per story notes
- Full regression: 130/130 tests passing

### File List
- `backend/app/snapshots.py` — NEW: snapshot background task module
- `backend/app/main.py` — MODIFIED: added snapshot task to lifespan
- `backend/tests/test_snapshots.py` — NEW: 5 tests for snapshot task
