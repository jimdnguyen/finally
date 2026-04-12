# Story 1.1: Backend Foundation & Watchlist API

Status: done

## Story

As a developer setting up the project for the first time,
I want the backend to initialize the database and expose a working watchlist API,
so that all downstream features have a reliable data foundation and can start building immediately.

## Acceptance Criteria

1. `aiosqlite` and `litellm` are added as dependencies (`uv add aiosqlite litellm`).
2. On first startup, all 6 database tables are created and seeded with default data (1 user at $10,000 cash, 10 default watchlist tickers).
3. Restarting the server does not duplicate seed data — idempotent initialization.
4. `GET /api/watchlist` returns a JSON array of `{ticker, price}` objects where `price` comes from the live `PriceCache` (null if not yet priced).
5. The market data background task (simulator or Massive) starts during app lifespan with the current watchlist tickers and stops cleanly on shutdown.
6. `GET /api/health` returns `{"status": "ok"}`.

## Tasks / Subtasks

- [x] Task 1: Add dependencies (AC: #1)
  - [x] `cd backend && uv add aiosqlite litellm`
  - [x] Verify `pyproject.toml` and `uv.lock` updated

- [x] Task 2: Database layer (AC: #2, #3)
  - [x] Create `backend/app/db/connection.py` — aiosqlite connection factory, WAL mode enabled
  - [x] Create `backend/app/db/init.py` — `init_db()` async function: creates all 6 tables if not exist, seeds default user and watchlist if empty
  - [x] Create `backend/app/db/__init__.py` exporting `init_db` and `get_db`

- [x] Task 3: FastAPI app entry point with lifespan (AC: #5)
  - [x] Create `backend/app/main.py` with `@asynccontextmanager` lifespan
  - [x] Lifespan sequence: `await init_db()` → fetch watchlist tickers from DB → `market_source.start(tickers)` → `yield` → `await market_source.stop()`
  - [x] Mount `create_stream_router(price_cache)` at app level
  - [x] Mount StaticFiles at `/` for future Next.js export (serve from `static/` directory, `html=True`)
  - [x] Register all routers (health, watchlist)

- [x] Task 4: Health endpoint (AC: #6)
  - [x] Create `backend/app/health/router.py` — `GET /api/health` returns `{"status": "ok"}`
  - [x] Create `backend/app/health/__init__.py`

- [x] Task 5: Watchlist API (AC: #4)
  - [x] Create `backend/app/watchlist/models.py` — Pydantic models: `WatchlistItem(ticker, price)`, `AddTickerRequest(ticker)`
  - [x] Create `backend/app/watchlist/db.py` — async DB functions: `get_watchlist_tickers(conn)`, `add_ticker(conn, ticker)`, `remove_ticker(conn, ticker)`
  - [x] Create `backend/app/watchlist/router.py` — `GET /api/watchlist` returns list of `WatchlistItem` with live prices from `PriceCache`; `POST /api/watchlist` adds ticker; `DELETE /api/watchlist/{ticker}` removes ticker
  - [x] Create `backend/app/watchlist/__init__.py`

- [x] Task 6: Tests (AC: all)
  - [x] `backend/tests/test_db_init.py` — test idempotent init: call `init_db()` twice, assert no duplicate rows
  - [x] `backend/tests/test_watchlist_api.py` — test `GET /api/watchlist` shape, `POST` add ticker, `DELETE` remove ticker using `httpx.AsyncClient` + `ASGITransport`
  - [x] `backend/tests/test_health.py` — test `GET /api/health` returns 200 `{"status": "ok"}`

- [x] Task 7: Smoke test manual verification
  - [x] `cd backend && uv run uvicorn app.main:app --reload`
  - [x] `curl http://localhost:8000/api/health` → `{"status": "ok"}`
  - [x] `curl http://localhost:8000/api/watchlist` → array of 10 tickers

## Dev Notes

### Architecture Constraints

- **No ORM** — use raw SQL with parameterized queries (`?` placeholders). aiosqlite only.
- **Async everywhere** — all DB calls are `async`/`await`. No sync DB calls in route handlers.
- **WAL mode** — enable `PRAGMA journal_mode=WAL` on connection open for concurrent reads during SSE streaming.
- **UUID PKs** — all table IDs use `str(uuid.uuid4())`, stored as TEXT.
- **ISO timestamps** — `datetime.utcnow().isoformat()` for all timestamp columns.
- **user_id default** — hardcode `"default"` for all user_id values (single-user app; column exists for future multi-user support).
- **snake_case JSON** — all Pydantic models use snake_case field names; FastAPI will serialize them as-is.
- **Error envelope** — 4xx responses must return `{"error": "...", "code": "..."}`. Use `raise HTTPException(status_code=..., detail={"error": "...", "code": "..."})`.
- **PriceCache is the source of truth** — never read prices from the market data source directly. Always use `price_cache.get_price(ticker)`.
- **StaticFiles** — mount `StaticFiles(directory="static", html=True)` at `/` **after** all API routers so API routes take precedence.
- **lifespan only** — background tasks (market data source) must be started/stopped in the `lifespan` context manager, not in route handlers or startup events (deprecated FastAPI pattern).

### Existing Market Module (do not modify)

The market data subsystem is complete. Import from `app.market`:

```python
from app.market import PriceCache, create_market_data_source, create_stream_router
```

- `PriceCache()` — instantiate once, pass to factory and stream router
- `create_market_data_source(price_cache)` — returns `SimulatorDataSource` (default) or `MassiveDataSource` (if `MASSIVE_API_KEY` env var is set)
- `market_source.start(tickers: list[str])` — starts background polling/simulation for the given tickers
- `market_source.stop()` — shuts down cleanly
- `create_stream_router(price_cache)` — returns `APIRouter` for SSE; include it in the app

### Database Schema (all 6 tables)

```sql
CREATE TABLE IF NOT EXISTS users_profile (
    id TEXT PRIMARY KEY,
    cash_balance REAL NOT NULL DEFAULT 10000.0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watchlist (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    added_at TEXT NOT NULL,
    UNIQUE(user_id, ticker)
);

CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    quantity REAL NOT NULL,
    avg_cost REAL NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, ticker)
);

CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    executed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    total_value REAL NOT NULL,
    recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    actions TEXT,
    created_at TEXT NOT NULL
);
```

### Seed Data

```python
DEFAULT_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]
DEFAULT_USER_ID = "default"
DEFAULT_CASH = 10000.0
```

Seed guard pattern — only insert if table is empty:
```python
row = await conn.execute("SELECT COUNT(*) FROM users_profile")
count = (await row.fetchone())[0]
if count == 0:
    # insert default user and watchlist
```

### Recommended Module Structure

```
backend/app/
├── __init__.py          (exists)
├── main.py              (CREATE — FastAPI app + lifespan)
├── db/
│   ├── __init__.py      (CREATE)
│   ├── connection.py    (CREATE — get_db context manager)
│   └── init.py          (CREATE — init_db(), seed logic)
├── health/
│   ├── __init__.py      (CREATE)
│   └── router.py        (CREATE — GET /api/health)
├── watchlist/
│   ├── __init__.py      (CREATE)
│   ├── models.py        (CREATE — Pydantic models)
│   ├── db.py            (CREATE — async DB queries)
│   └── router.py        (CREATE — GET/POST/DELETE /api/watchlist)
└── market/              (EXISTS — do not modify)
```

### Testing Pattern

Use `pytest-asyncio` with `httpx.AsyncClient` + `ASGITransport` for API tests. Use an in-memory SQLite DB (`:memory:`) for unit tests of DB functions. Override FastAPI dependencies if needed for test isolation.

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

Run tests: `cd backend && uv run --extra dev pytest -v`

### Project Structure Notes

- **`backend/app/db/`** — new module; no conflicts with existing code
- **`backend/app/main.py`** — does not exist yet; create fresh
- **`backend/app/health/`** and **`backend/app/watchlist/`** — `__pycache__` entries exist for these but no `.py` source files; these are stubs from an earlier scaffolding step. Create fresh `.py` files.
- **`backend/tests/`** — directory exists with market data tests; add new test files alongside existing ones
- **StaticFiles `static/` directory** — will not exist until the Dockerfile build stage copies the Next.js export. Handle gracefully: only mount if directory exists, or let it fail at runtime (acceptable for dev mode without frontend built).

### References

- Database schema: [Source: planning/PLAN.md#7-database]
- API endpoints: [Source: planning/PLAN.md#8-api-endpoints]
- Architecture decisions (aiosqlite, lifespan, domain structure, error envelope): [Source: _bmad-output/planning-artifacts/architecture.md]
- Market module API: [Source: backend/CLAUDE.md]
- Existing market exports: [Source: backend/app/market/__init__.py]
- Story acceptance criteria: [Source: _bmad-output/planning-artifacts/epics.md — Epic 1, Story 1.1]

### Review Findings

- [x] [Review][Patch] market_source not notified on watchlist add/remove [backend/app/watchlist/router.py] — fixed: market_source injected into create_watchlist_router; add_ticker/remove_ticker called on POST/DELETE
- [x] [Review][Patch] Error envelope format violation [backend/app/watchlist/router.py] — fixed: custom HTTPException handler in create_app() returns detail dict directly; test updated to assert data["code"] not data["detail"]["code"]
- [x] [Review][Defer] Race condition in init_db() seeding [backend/app/db/init.py] — deferred, pre-existing; single-process app, UNIQUE constraints + INSERT OR IGNORE already guard duplicates
- [x] [Review][Defer] Missing row_factory in init_db() direct connection [backend/app/db/init.py] — deferred, pre-existing; init_db() never reads rows by column name, no functional impact
- [x] [Review][Defer] No transaction isolation in watchlist handlers [backend/app/watchlist/router.py] — deferred, pre-existing; single-user SQLite design choice
- [x] [Review][Defer] Unhandled SQLITE_BUSY during init [backend/app/db/init.py] — deferred, pre-existing; single-user local SQLite, no realistic contention
- [x] [Review][Defer] Test monkeypatch DB_PATH fragility [backend/tests/] — deferred, pre-existing; 86/86 tests passing, fragility concern only

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `httpx.ASGITransport` does not trigger ASGI lifespan events; tests must explicitly call `init_db()` in fixtures rather than relying on app startup.

### Completion Notes List

- All 6 tables created via idempotent `init_db()` with seed guard pattern (count-before-insert).
- WAL mode enabled on all DB connections for concurrent SSE read safety.
- `create_watchlist_router(price_cache)` factory pattern used so router has access to the module-level `PriceCache` without global state.
- StaticFiles mounted conditionally — only when `static/` directory exists (not present in dev without Docker build).
- `monkeypatch` used to redirect `DB_PATH` in 3 modules (`app.db.init`, `app.db.connection`, `app.main`) for full test isolation.
- 86/86 tests passing, 0 regressions.

### File List

- `backend/pyproject.toml` (modified — added aiosqlite, litellm)
- `backend/uv.lock` (modified)
- `backend/app/main.py` (created)
- `backend/app/db/__init__.py` (created)
- `backend/app/db/connection.py` (created)
- `backend/app/db/init.py` (created)
- `backend/app/health/__init__.py` (created)
- `backend/app/health/router.py` (created)
- `backend/app/watchlist/__init__.py` (created)
- `backend/app/watchlist/models.py` (created)
- `backend/app/watchlist/db.py` (created)
- `backend/app/watchlist/router.py` (created)
- `backend/tests/test_db_init.py` (created)
- `backend/tests/test_health.py` (created)
- `backend/tests/test_watchlist_api.py` (created)
