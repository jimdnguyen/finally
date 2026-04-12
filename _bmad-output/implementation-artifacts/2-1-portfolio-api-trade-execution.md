# Story 2.1: Portfolio API & Trade Execution

Status: done

## Story

As a **user who wants to trade**,
I want **the backend to handle buy/sell orders and track my portfolio**,
so that **trades execute instantly and my positions are always accurate**.

## Acceptance Criteria

1. **Given** the app is running, **when** `GET /api/portfolio` is called, **then** it returns `{cash_balance, positions: [{ticker, quantity, avg_cost, current_price, unrealized_pnl, pnl_pct}], total_value}` with all fields in `snake_case`.
2. **Given** a user submits `POST /api/portfolio/trade` with `{ticker, quantity, side: "buy"}` and has sufficient cash, **then** the trade executes at current price from `PriceCache.get(ticker)`, `positions` is upserted with weighted avg cost, `cash_balance` decreases, a `trades` row is appended, a portfolio snapshot is recorded immediately, and the response contains the updated portfolio.
3. **Given** a user submits a buy order with insufficient cash, **when** the trade is validated, **then** the API returns HTTP 400 with `{"error": "Insufficient cash", "code": "INSUFFICIENT_CASH"}` and no DB state changes.
4. **Given** a user submits `POST /api/portfolio/trade` with `{side: "sell"}` and owns sufficient shares, **then** cash increases by `quantity * current_price`, position quantity decreases (row deleted if quantity reaches 0), snapshot recorded immediately.
5. **Given** a user submits a sell order for more shares than owned, **when** validated, **then** API returns HTTP 400 with `{"error": "Insufficient shares", "code": "INSUFFICIENT_SHARES"}`.
6. **Given** `GET /api/portfolio/history` is called, **then** it returns an array of `{recorded_at, total_value}` snapshots in ascending time order.

## Tasks / Subtasks

- [x] Task 1: Centralize DB_PATH configuration (AC: all — Epic 1 retro action item #3)
  - [x] 1.1 Create `backend/app/db/config.py` with a single `DB_PATH` definition
  - [x] 1.2 Update `backend/app/db/connection.py` to import from `config.py`
  - [x] 1.3 Update `backend/app/db/init.py` to import from `config.py`
  - [x] 1.4 Update `backend/app/main.py` to import `DB_PATH` from `app.db.config`
  - [x] 1.5 Run existing tests (`test_db_init.py`, `test_health.py`, `test_watchlist_api.py`) to confirm no regressions
  - [x] 1.6 Verify tests only need 1 monkeypatch target for `DB_PATH` instead of 3

- [x] Task 2: Create portfolio Pydantic models (AC: 1, 2)
  - [x] 2.1 Create `backend/app/portfolio/models.py` with:
    - `TradeRequest`: `ticker: str`, `quantity: float`, `side: str`
    - `PositionResponse`: `ticker`, `quantity`, `avg_cost`, `current_price`, `unrealized_pnl`, `pnl_pct`
    - `PortfolioResponse`: `cash_balance`, `positions: list[PositionResponse]`, `total_value`
    - `PortfolioHistoryPoint`: `recorded_at: str`, `total_value: float`
  - [x] 2.2 Write tests for model validation (side must be "buy" or "sell", quantity > 0)

- [x] Task 3: Create portfolio DB functions (AC: 1, 2, 4)
  - [x] 3.1 Create `backend/app/portfolio/db.py` with:
    - `get_cash_balance(conn) -> float`
    - `update_cash_balance(conn, new_balance: float)`
    - `get_positions(conn) -> list[dict]`
    - `upsert_position(conn, ticker, quantity, avg_cost)`
    - `delete_position(conn, ticker)`
    - `insert_trade(conn, ticker, side, quantity, price)`
    - `insert_snapshot(conn, total_value)`
    - `get_snapshots(conn) -> list[dict]`
  - [x] 3.2 Write tests for each DB function

- [x] Task 4: Create portfolio service (trade execution logic) (AC: 2, 3, 4, 5)
  - [x] 4.1 Create `backend/app/portfolio/service.py` with `execute_trade(conn, ticker, quantity, side, current_price) -> dict`
    - Buy: validate cash >= quantity * price, compute weighted avg cost if position exists, upsert position, deduct cash, insert trade row
    - Sell: validate position exists and quantity <= owned, increase cash, reduce position (delete if 0), insert trade row
    - Return updated portfolio dict
  - [x] 4.2 The service function must record a portfolio snapshot immediately after successful trade
  - [x] 4.3 Write tests: buy new position, buy into existing (weighted avg cost), sell partial, sell all (position deleted), insufficient cash, insufficient shares, sell ticker not owned

- [x] Task 5: Create portfolio router (AC: 1, 2, 3, 4, 5, 6)
  - [x] 5.1 Create `backend/app/portfolio/router.py` with factory function `create_portfolio_router(price_cache: PriceCache) -> APIRouter`
    - `GET /api/portfolio` — returns `PortfolioResponse` with live prices from `PriceCache`
    - `POST /api/portfolio/trade` — validates, executes trade, returns updated portfolio
    - `GET /api/portfolio/history` — returns snapshot array
  - [x] 5.2 Wire router into `backend/app/main.py` via `app.include_router(create_portfolio_router(price_cache), prefix="/api")`
  - [x] 5.3 Write integration tests for all 3 endpoints (success + error cases)

- [x] Task 6: Full regression test run
  - [x] 6.1 Run ALL tests (`uv run --extra dev pytest -v`) — existing + new must pass
  - [x] 6.2 Verify watchlist tests still pass with centralized DB_PATH

## Dev Notes

### Architecture Compliance

**Domain structure** — Follow the established watchlist pattern exactly:
```
backend/app/portfolio/
  __init__.py        # empty
  router.py          # FastAPI router, factory function
  service.py         # Business logic
  models.py          # Pydantic models
  db.py              # aiosqlite queries
```

**Router factory pattern** — Same as `create_watchlist_router()`:
```python
def create_portfolio_router(price_cache: PriceCache) -> APIRouter:
    router = APIRouter()
    # ... define routes ...
    return router
```

**Error responses** — Use the established envelope format:
```python
raise HTTPException(status_code=400, detail={"error": "Insufficient cash", "code": "INSUFFICIENT_CASH"})
```

**DB access** — Always use `async with get_db() as conn:` context manager. All queries parameterized.

**Price reads** — Get current price via `price_cache.get_price(ticker)`. Never import simulator directly.

### Weighted Average Cost Calculation

When buying into an existing position:
```
new_avg_cost = ((existing_qty * existing_avg_cost) + (buy_qty * buy_price)) / (existing_qty + buy_qty)
```

### Portfolio Total Value Computation

```
total_value = cash_balance + sum(position.quantity * current_price for each position)
```
Where `current_price` comes from `PriceCache.get_price(ticker)`. If a ticker has no cached price, use `avg_cost` as fallback.

### Unrealized P&L

```
unrealized_pnl = (current_price - avg_cost) * quantity
pnl_pct = ((current_price - avg_cost) / avg_cost) * 100
```

### Snapshot Recording

After each successful trade, record a snapshot inline (not in background task — that's Story 2.2):
```python
total_value = compute_total_value(conn, price_cache)
await insert_snapshot(conn, total_value)
```

### DB_PATH Centralization (Epic 1 Retro Action Item #3)

Currently `DB_PATH` is defined in `connection.py` and separately imported/used in `init.py` and `main.py`, requiring 3 monkeypatches in tests. Centralize to a single `db/config.py` so tests only need 1 monkeypatch target.

### Tables Used (already exist from init.py)

- `users_profile` — read/update `cash_balance`
- `positions` — upsert/delete positions (UNIQUE on `user_id, ticker`)
- `trades` — append-only trade log
- `portfolio_snapshots` — insert snapshots after trades

### API Response Examples

**GET /api/portfolio:**
```json
{
  "cash_balance": 8500.00,
  "positions": [
    {
      "ticker": "AAPL",
      "quantity": 10.0,
      "avg_cost": 150.00,
      "current_price": 191.23,
      "unrealized_pnl": 412.30,
      "pnl_pct": 27.49
    }
  ],
  "total_value": 10412.30
}
```

**POST /api/portfolio/trade (request):**
```json
{"ticker": "AAPL", "quantity": 5, "side": "buy"}
```

**POST /api/portfolio/trade (success response):**
Returns the same shape as `GET /api/portfolio` — the updated portfolio after trade execution.

**POST /api/portfolio/trade (error response):**
```json
{"error": "Insufficient cash", "code": "INSUFFICIENT_CASH"}
```

**GET /api/portfolio/history:**
```json
[
  {"recorded_at": "2026-04-11T17:33:09Z", "total_value": 10000.00},
  {"recorded_at": "2026-04-11T17:33:39Z", "total_value": 10234.50}
]
```

### Previous Story Intelligence (Epic 1)

- **Test pattern**: Use `pytest-asyncio` with `asyncio_mode = "auto"`. Use `monkeypatch` to override `DB_PATH` to a temp file. Use `ASGITransport` + `AsyncClient` for integration tests.
- **Import style**: `from app.db.connection import get_db` — functions take `conn` parameter for testability.
- **User ID**: Always hardcode `'default'` — never parameterize for MVP.
- **Timestamps**: `datetime.now(timezone.utc).isoformat()` — always UTC, always ISO format.
- **UUIDs**: `str(uuid.uuid4())` for all primary keys.
- **Commit pattern**: Call `await conn.commit()` after write operations in db.py functions.

### Project Structure Notes

- `backend/app/portfolio/` directory does not exist yet — create it
- `backend/app/db/config.py` does not exist yet — create it for DB_PATH centralization
- `backend/app/main.py` needs the portfolio router wired in alongside existing routers
- All existing modules (`market/`, `watchlist/`, `health/`, `db/`) must remain untouched except for DB_PATH import changes

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 2.1 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/architecture.md — ARCH-9 error codes, ARCH-11 post-trade refetch, ARCH-12 snake_case, ARCH-14 PriceCache, ARCH-16 snapshot timing, ARCH-21 domain structure]
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-04-11.md — Action item #3: centralize DB_PATH]
- [Source: PLAN.md — Schema definitions, API endpoints, portfolio math]
- [Source: backend/app/watchlist/router.py — Router factory pattern reference]

### Review Findings

**Reviewed by:** Claude Opus 4.6 (3-layer adversarial review: Blind Hunter, Edge Case Hunter, Acceptance Auditor)

| ID | Layer | Severity | Finding | Resolution |
|----|-------|----------|---------|------------|
| F1 | Blind Hunter | patch | Snapshot `total_value` used `avg_cost` for non-traded positions instead of live prices | **Patched** — Added `get_price: Callable` param to `execute_trade()`, `_resolve_price()` helper uses live prices. Router passes `price_cache.get_price`. New test added. |
| F2 | Edge Case | deferred | No rounding on `total_value` in snapshot (floating-point accumulation) | Deferred to Story 2.2 (snapshot background task) |
| F3 | Edge Case | deferred | No concurrency guard on rapid successive trades | Deferred — single-user MVP, SQLite serializes writes |
| F4 | Edge Case | deferred | `quantity: float` allows negative values at DB layer (Pydantic validates at API boundary only) | Deferred — service is only called via validated router |
| F5–F13 | Various | dismissed | False positives, style nits, or already-handled concerns | Dismissed during triage |

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (Amelia persona)

### Debug Log References
- DB_PATH monkeypatch fix: changed `from .config import DB_PATH` to `from . import config` + `config.DB_PATH` to fix reference-copy issue (4 test failures resolved)
- sqlite3.Row assertion fix: `rows[0]` returns Row object not tuple, access by index
- F1 review fix: added `get_price` callable injection to `execute_trade()` so snapshots use live prices for all positions, not just the traded ticker

### Completion Notes List
- Task 1: Centralized DB_PATH to `app/db/config.py`, updated all imports to use module-level import pattern, reduced monkeypatch targets from 3 to 1
- Task 2: Created Pydantic models with `Literal["buy","sell"]` validation and `Field(gt=0)` for quantity
- Task 3: Created 8 async DB functions following established patterns (UUID PKs, UTC ISO timestamps, parameterized queries)
- Task 4: Service layer with `execute_trade()`, weighted avg cost on buy, position deletion on full sell, inline snapshot recording after each trade. Post-review: added `get_price` callable + `_resolve_price()` for accurate multi-position snapshots.
- Task 5: Router factory `create_portfolio_router(price_cache)` with 3 endpoints. `_build_position_response()` computes unrealized P&L and pnl_pct using live prices from PriceCache (falls back to avg_cost). Wired into main.py. Post-review: passes `price_cache.get_price` to `execute_trade()`.
- Task 6: Full regression — 125/125 tests pass (86 existing + 39 new)
- All 6 ACs covered by integration tests
- Code review: 1 patch applied (F1), 3 deferred, 9 dismissed

### File List
- `backend/app/db/config.py` — NEW: centralized DB_PATH
- `backend/app/db/connection.py` — MODIFIED: import config module
- `backend/app/db/init.py` — MODIFIED: import config module
- `backend/app/main.py` — MODIFIED: import config module, wire portfolio router
- `backend/app/portfolio/__init__.py` — NEW: empty package init
- `backend/app/portfolio/models.py` — NEW: Pydantic models (TradeRequest, PositionResponse, PortfolioResponse, PortfolioHistoryPoint)
- `backend/app/portfolio/db.py` — NEW: 8 async DB functions
- `backend/app/portfolio/service.py` — NEW: trade execution logic
- `backend/app/portfolio/router.py` — NEW: portfolio router factory with 3 endpoints
- `backend/tests/test_portfolio_models.py` — NEW: 9 model validation tests
- `backend/tests/test_portfolio_db.py` — NEW: 9 DB function tests
- `backend/tests/test_portfolio_service.py` — NEW: 10 service tests (9 original + 1 live-price snapshot test from review)
- `backend/tests/test_portfolio_api.py` — NEW: 11 integration tests
- `backend/tests/test_db_init.py` — MODIFIED: single monkeypatch target
- `backend/tests/test_health.py` — MODIFIED: single monkeypatch target
- `backend/tests/test_watchlist_api.py` — MODIFIED: single monkeypatch target
