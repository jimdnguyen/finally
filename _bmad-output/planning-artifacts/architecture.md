---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-04-11'
inputDocuments: ['_bmad-output/planning-artifacts/prd.md']
workflowType: 'architecture'
project_name: 'finally'
user_name: 'Jim'
date: '2026-04-11'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
37 FRs across 8 domains: market data streaming (FR1–5), watchlist management (FR6–9),
chart/market detail (FR10–11), portfolio & trading (FR12–18), AI chat assistant (FR19–27),
notifications (FR28–30), portfolio history & persistence (FR31–33), and system/operations (FR34–37).

The AI chat domain (9 FRs) is the largest single category, reflecting the core product
differentiator: the LLM as a first-class application operator that reads live state and
executes mutations through validated pathways.

**Non-Functional Requirements:**
14 NFRs across 4 categories:
- Performance: sub-100ms price render, sub-1s trade execution, <3s initial load, no frame drops at 500ms SSE cadence, non-blocking background tasks
- Reliability: SSE auto-reconnect, LLM failure isolation, clean DB init from fresh volume, state persistence across restarts
- Security: API key only via env vars (never logged/hardcoded), no destructive DB endpoints without user action
- Integration: fixed LiteLLM model string (`openrouter/openrouter/free`), deterministic mock mode, graceful fallback from Massive API to simulator

**Scale & Complexity:**

- Primary domain: Full-stack web (FastAPI + Next.js static SPA, single-container Docker)
- Complexity level: Medium
- Estimated architectural components: ~8 (price stream, watchlist API, portfolio API, chat API,
  frontend state layer, charting/visualization, AI integration module, background task orchestrator)

### Technical Constraints & Dependencies

- **Brownfield**: Market data module complete — simulator, Massive API client, price cache, `/api/stream/prices` SSE endpoint. Architecture must consume this interface.
- **Single container, single port**: All static assets and API routes served by FastAPI on port 8000. No separate Node.js runtime at runtime.
- **SQLite**: No migration tooling required; lazy initialization on startup. Single-file DB mounted as Docker volume.
- **LiteLLM → OpenRouter**: Model string fixed at `openrouter/openrouter/free` (Cerebras inference). Structured output required for trade/watchlist parsing.
- **Static Next.js export**: No SSR, no Next.js API routes, no getServerSideProps. All data fetching via client-side REST and SSE.
- **uv**: Python dependency management. All Python commands via `uv run` / `uv add`.

### Cross-Cutting Concerns Identified

1. **Real-time state synchronization**: SSE price events must update sparkline buffers, flash animations, and live price displays simultaneously without re-fetching REST endpoints.
2. **Dual write path consistency**: Both the trade bar and AI chat execute trades via the same `/api/portfolio/trade` endpoint. Frontend must refresh portfolio state after either path completes.
3. **LLM failure isolation**: Chat panel errors (timeout, malformed response, API error) must not interrupt the SSE connection, price display, or portfolio state. Requires independent error boundaries.
4. **Background task lifecycle**: Market data task and portfolio snapshot task must start on app startup and shut down cleanly. Must not block request handlers.
5. **Implementation substitution seams**: Two clean swap points — market data source (env-driven: simulator vs. Massive) and LLM responses (env-driven: live vs. mock). Both must be transparent to business logic.

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web application — FastAPI (Python) backend + Next.js (TypeScript) frontend,
single Docker container. Stack is prescribed by project PLAN.md; this section documents
the existing state and initialization commands for each layer.

### Backend — Already Initialized

The backend was bootstrapped as part of the brownfield market data phase.

**Existing setup at `backend/`:**
- Runtime: Python 3.12, managed with `uv`
- Web framework: FastAPI 0.115+, uvicorn[standard]
- Scientific/data: numpy 2.0+
- Market data: massive 1.0+ (Polygon.io client)
- Dev tools: pytest, pytest-asyncio, pytest-cov, ruff

**Additional dependencies needed (not yet in pyproject.toml):**
```bash
# Add to backend during implementation
uv add litellm        # LLM integration via OpenRouter
uv add httpx          # Async HTTP client (LLM calls, health checks)
```

**No re-initialization needed.** Module stubs already exist for all remaining domains.

### Frontend — Needs Initialization

No `frontend/` directory exists yet. Initialize with:

```bash
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript strict mode; Next.js App Router
- Static export configured in `next.config.ts`: `output: 'export'`

**Styling Solution:**
- Tailwind CSS with custom theme extending `tailwind.config.ts`:
  - Background: `#0d1117` / `#1a1a2e`
  - Accent yellow: `#ecad0a`
  - Blue primary: `#209dd7`
  - Purple secondary: `#753991`

**Build Tooling:**
- Next.js built-in (webpack); `next build` produces static export in `out/`
- Dockerfile Stage 1 copies `out/` into Stage 2 Python image

**Testing Framework:**
- Jest + React Testing Library (included by create-next-app)
- Playwright E2E lives in `test/` (separate from frontend unit tests)

**Code Organization:**
- `src/app/` — Next.js App Router pages (single `page.tsx` for SPA)
- `src/components/` — UI components (watchlist, chart, portfolio, chat, etc.)
- `src/hooks/` — Custom hooks (useSSE, usePrices, usePortfolio, etc.)
- `src/lib/` — API client functions

**Key Additional Packages (added during implementation):**
```bash
cd frontend
npm install lightweight-charts       # Canvas-based charting
npm install react-hot-toast          # Toast notifications
```

**Note:** Frontend initialization (`create-next-app` command above) should be the first frontend implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- DB interaction approach: `aiosqlite` + raw SQL
- Frontend state management: Zustand for SSE price state
- Error response shape: structured envelope `{"error": "...", "code": "..."}`

**Important Decisions (Shape Architecture):**
- Background task lifecycle: FastAPI `lifespan` async context manager
- LLM mock strategy: pure Python fixture, no LiteLLM call when `LLM_MOCK=true`
- Static file serving: `StaticFiles` with `html=True` for SPA fallback

**Deferred Decisions (Post-MVP):**
- Auth / multi-user (schema is pre-seeded with `user_id` columns — no migration needed when deferred)
- Cloud deployment (Terraform / App Runner config)

### Data Architecture

**Database interaction: `aiosqlite` + raw SQL**
- Rationale: SQLite-only, fixed schema, single-user, simple CRUD. No ORM abstraction needed.
  SQLModel/SQLAlchemy adds value when swapping databases or needing Alembic migrations — neither applies here.
- `aiosqlite` provides async context managers for connection handling
- Pydantic v2 models used at the API boundary only (request/response validation); not coupled to DB layer
- Lazy initialization: on app startup, check for tables; create schema + seed if missing

**Caching:**
- In-memory price cache (already implemented in `app/market/`) — the `PriceCache` class is the single source of truth for live prices
- No additional caching layer needed

**Data validation:**
- Pydantic v2 for all API request/response models (FastAPI built-in)
- DB writes use parameterized queries (aiosqlite default — no SQL injection surface)

### Authentication & Security

- **No authentication**: single-user app, `user_id="default"` hardcoded throughout
- **API key handling**: `OPENROUTER_API_KEY` read from environment only (`os.environ`); never logged, never returned in responses
- **No destructive endpoints**: no `DELETE /api/database` or equivalent; watchlist DELETE is scoped to a single ticker

### API & Communication Patterns

**REST + SSE:**
- All mutations via REST (`POST`, `DELETE`)
- Live price stream via SSE (`GET /api/stream/prices`) — one-way server push, no WebSocket needed

**Error response envelope:**
```json
{"error": "Human-readable description", "code": "MACHINE_READABLE_CODE"}
```
HTTP status codes used correctly (400 validation, 404 not found, 422 Pydantic validation, 500 server error).

Common error codes: `INSUFFICIENT_CASH`, `INSUFFICIENT_SHARES`, `TICKER_NOT_FOUND`,
`TICKER_ALREADY_IN_WATCHLIST`, `LLM_ERROR`, `INVALID_QUANTITY`.

**Background task lifecycle:**
- FastAPI `lifespan` async context manager (not per-request `BackgroundTasks`)
- Startup: initialize DB, start market data source, start portfolio snapshot task
- Shutdown: stop market data source, cancel snapshot task cleanly

**Portfolio snapshots:**
- Recorded every 30 seconds by the snapshot background task
- Also recorded immediately after each trade execution (inline in trade handler)

### Frontend Architecture

**State management: Zustand**
- `usePriceStore`: holds `Record<ticker, PriceUpdate>` — updated on every SSE event
- Components subscribe to specific tickers via selectors — no re-render storms at 500ms cadence
- Sparkline buffers: `Record<ticker, number[]>` accumulated in the same store since page load
- `usePortfolioStore`: portfolio positions, cash balance — fetched from REST, refreshed after any trade (manual or AI-executed)
- `useWatchlistStore`: watchlist tickers — fetched from REST, refreshed after add/remove

**SSE connection management:**
- Single `useSSE` hook at app root — one `EventSource` per session
- Feeds into `usePriceStore` — all price consumers read from the store, not from the hook directly
- Connection status (connected / reconnecting / disconnected) tracked in store

**Component boundaries:**
- Each panel is an independent component (`WatchlistPanel`, `ChartPanel`, `PortfolioHeatmap`, `PnLChart`, `PositionsTable`, `TradeBar`, `ChatPanel`, `Header`)
- Chat panel has its own error boundary — LLM failures cannot propagate to sibling components

### Infrastructure & Deployment

**Single Docker container:**
- Multi-stage build: Node 20 (Next.js build) → Python 3.12 (runtime)
- FastAPI serves `frontend/out/` via `StaticFiles(html=True)` — SPA fallback to `index.html`
- API routes registered before static mount — `/api/*` takes precedence
- SQLite volume: `-v finally-data:/app/db`

**LLM mock mode:**
- `LLM_MOCK=true` → chat handler returns a hardcoded `ChatResponse` fixture
- Fixture includes a sample buy trade for E2E coverage of the full agentic loop
- Zero LiteLLM calls in mock mode — deterministic, no network dependency

**uv + npm:**
- Backend: all Python commands via `uv run` / `uv add`
- Frontend: standard `npm install` / `npm run build`

### Decision Impact Analysis

**Implementation Sequence:**
1. Frontend init (`create-next-app`) — unblocks all frontend work
2. Backend: add `aiosqlite` + `litellm` dependencies, implement DB init module
3. Backend: implement remaining API routes (portfolio, watchlist, chat, health) on top of existing market data layer
4. Frontend: Zustand stores + SSE hook — unblocks all real-time UI components
5. Frontend: UI components (watchlist → trade bar → positions → chat → visualizations)
6. Docker: wire multi-stage build, test full container flow

**Cross-Component Dependencies:**
- Price store (Zustand) ← SSE hook ← `/api/stream/prices` (already complete)
- Portfolio store (Zustand) ← REST fetch ← `/api/portfolio` (to build)
- Trade bar + AI chat → both call `/api/portfolio/trade` → both trigger portfolio store refresh
- Chat panel → `/api/chat` → auto-executes trades internally → returns updated state
- Portfolio snapshots ← trade handler (inline) + background task (30s timer)

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified
8 areas where agents could make different choices without explicit rules.

### Naming Patterns

**Database Naming Conventions:**
- Tables: `snake_case` plural nouns — `users_profile`, `watchlist`, `positions`, `trades`,
  `portfolio_snapshots`, `chat_messages` (match PLAN.md schema exactly)
- Columns: `snake_case` — `user_id`, `cash_balance`, `avg_cost`, `executed_at`
- Primary keys: always `id TEXT PRIMARY KEY` (UUID string)
- Timestamps: always `TEXT` ISO 8601 format (`2026-04-11T17:33:09Z`)

**API Naming Conventions:**
- Endpoints: `snake_case`, plural resource nouns — `/api/watchlist`, `/api/portfolio`,
  `/api/portfolio/history`, `/api/portfolio/trade`
  (exception: `/api/stream/prices` — already implemented, keep as-is)
- Path parameters: `snake_case` — `/api/watchlist/{ticker}`
- JSON field names: **`snake_case` throughout** — backend and frontend both use snake_case.
  No camelCase aliases. Keeps parity with DB column names and avoids transform layer.
  Example: `avg_cost`, `cash_balance`, `executed_at`, `change_percent`

**Code Naming Conventions:**
- Python: `snake_case` functions/variables, `PascalCase` classes — standard PEP 8
- TypeScript: `camelCase` variables/functions, `PascalCase` components/types/interfaces
- React components: `PascalCase` filename AND export — `WatchlistPanel.tsx`, `ChatPanel.tsx`
- Zustand stores: `use{Domain}Store` — `usePriceStore`, `usePortfolioStore`, `useWatchlistStore`
- Custom hooks: `use{Description}` — `useSSE`, `usePrices`, `usePortfolio`
- API client functions: `{verb}{Resource}` — `fetchPortfolio`, `executeTrade`, `addToWatchlist`

### Structure Patterns

**Backend file organization (`backend/app/`):**
```
app/
  {domain}/
    router.py     # FastAPI APIRouter, route handlers only
    service.py    # Business logic (pure functions where possible)
    models.py     # Pydantic request/response models
    db.py         # aiosqlite queries for this domain
  db/
    init.py       # Schema creation + seed data
    connection.py # aiosqlite connection factory
  main.py         # FastAPI app, lifespan, router registration
```
- Each domain is self-contained: `portfolio/`, `watchlist/`, `chat/`, `health/`, `market/`
- No cross-domain imports except through `db/connection.py` and `app/market/` public interface

**Frontend file organization (`frontend/src/`):**
```
src/
  app/
    page.tsx      # Single SPA entry point — layout only, no business logic
    layout.tsx    # Root layout with providers
  components/
    {Domain}/
      {Component}.tsx   # e.g., Watchlist/WatchlistPanel.tsx
  hooks/
    useSSE.ts
    usePrices.ts
    usePortfolio.ts
    useWatchlist.ts
  stores/
    priceStore.ts
    portfolioStore.ts
    watchlistStore.ts
  lib/
    api.ts        # All fetch calls — single file, typed functions
  types/
    index.ts      # All shared TypeScript interfaces/types
```

**Test file location:**
- Backend: `backend/tests/test_{domain}.py` — always in `tests/` directory
- Frontend: `frontend/src/components/{Domain}/{Component}.test.tsx` — co-located with component
- E2E: `test/*.spec.ts` — Playwright, always in top-level `test/` directory

### Format Patterns

**API Response Formats:**

Success responses return the resource directly (no envelope wrapper):
```json
// GET /api/portfolio
{
  "cash_balance": 8500.00,
  "positions": [...],
  "total_value": 10234.50
}
```

Error responses always use the envelope:
```json
// 400 response
{"error": "Insufficient cash to execute trade", "code": "INSUFFICIENT_CASH"}
```

Error codes (SCREAMING_SNAKE_CASE): `INSUFFICIENT_CASH`, `INSUFFICIENT_SHARES`,
`TICKER_NOT_FOUND`, `TICKER_ALREADY_IN_WATCHLIST`, `LLM_ERROR`, `INVALID_QUANTITY`,
`INVALID_SIDE`

**Data Exchange Formats:**
- All timestamps: ISO 8601 strings with timezone (`2026-04-11T17:33:09.123Z`)
- All IDs: UUID v4 strings
- Prices: plain `number` (float), never strings
- Quantities: `number` (float — fractional shares supported)
- Booleans: `true`/`false` — never `0`/`1`
- Nullable fields: `null` explicitly — never omitted

**SSE Event format (already implemented — do not change):**
```
data: {"ticker": "AAPL", "price": 191.23, "previous_price": 190.87,
       "timestamp": "...", "direction": "up", "change": 0.36, "change_percent": 0.19}
```

### Communication Patterns

**Zustand store update rules:**
- Price store: update via `set((state) => ({ prices: {...state.prices, [ticker]: update} }))` — immutable spread
- Sparkline buffers: append-only, capped at 200 data points per ticker
- Never mutate store state directly — always use `set()`

**Frontend → API communication:**
- All API calls go through `src/lib/api.ts` — no inline `fetch()` in components
- API functions return typed responses or throw `ApiError` (custom class with `code` field)
- Components never handle raw HTTP errors — use the typed error from `api.ts`

**After trade execution (both manual and AI-initiated):**
- Always refetch portfolio from `/api/portfolio` immediately after trade success
- Always refetch watchlist from `/api/watchlist` after watchlist changes
- Never optimistically update — always confirm from server

### Process Patterns

**Backend error handling:**
- Raise `HTTPException(status_code=400, detail={"error": "...", "code": "..."})` for business errors
- Let FastAPI handle Pydantic `422` validation errors automatically
- Never catch and swallow exceptions silently — log then re-raise or return error response

**Frontend error handling:**
- Chat panel: independent `try/catch` — errors shown inline in chat, never propagated up
- Trade bar: show error toast, re-enable submit button
- SSE disconnection: update connection status in store — do NOT show error toast (auto-reconnects)
- All other API errors: show error toast via `react-hot-toast`

**Loading state naming (TypeScript):**
```typescript
// In components and Zustand stores — always use isLoading
const [isLoading, setIsLoading] = useState(false)
// NOT: loading, isFetching, pending
```

### Enforcement Guidelines

**All AI agents MUST:**
- Use `snake_case` for all JSON field names — no camelCase in API responses
- Use the error envelope `{"error": "...", "code": "..."}` for all 4xx responses
- Route all API calls through `src/lib/api.ts` — never inline fetch in components
- Use `aiosqlite` parameterized queries — never string-format SQL
- Read market data only via `PriceCache` — never access simulator/Massive directly
- Use `uv run` / `uv add` for all Python commands — never `python` or `pip`

**Anti-patterns (never do these):**
- `camelCase` JSON fields (`avgCost` → use `avg_cost`)
- Inline `fetch('/api/portfolio')` in React components
- `f"SELECT * FROM trades WHERE id = '{trade_id}'"` (SQL injection risk)
- Importing from `app.market.simulator` directly — always use `PriceCache` interface
- `BackgroundTasks` for long-running loops — use `lifespan` instead

## Project Structure & Boundaries

### Directory Tree

```
finally/
├── frontend/                     # Next.js TypeScript project (static export)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # 🔨 Single SPA entry point — layout only
│   │   │   └── layout.tsx        # 🔨 Root layout with Zustand providers
│   │   ├── components/
│   │   │   ├── Watchlist/
│   │   │   │   └── WatchlistPanel.tsx    # 🔨
│   │   │   ├── Chart/
│   │   │   │   └── ChartPanel.tsx        # 🔨
│   │   │   ├── Portfolio/
│   │   │   │   ├── PortfolioHeatmap.tsx  # 🔨
│   │   │   │   ├── PnLChart.tsx          # 🔨
│   │   │   │   └── PositionsTable.tsx    # 🔨
│   │   │   ├── Trade/
│   │   │   │   └── TradeBar.tsx          # 🔨
│   │   │   ├── Chat/
│   │   │   │   └── ChatPanel.tsx         # 🔨 (has own error boundary)
│   │   │   └── Header/
│   │   │       └── Header.tsx            # 🔨
│   │   ├── stores/
│   │   │   ├── priceStore.ts             # 🔨 Zustand — SSE price fan-out
│   │   │   ├── portfolioStore.ts         # 🔨 Zustand — positions, cash
│   │   │   └── watchlistStore.ts         # 🔨 Zustand — watchlist tickers
│   │   ├── hooks/
│   │   │   ├── useSSE.ts                 # 🔨 Single EventSource lifecycle
│   │   │   ├── usePrices.ts              # 🔨
│   │   │   ├── usePortfolio.ts           # 🔨
│   │   │   └── useWatchlist.ts           # 🔨
│   │   ├── lib/
│   │   │   └── api.ts                    # 🔨 All fetch calls — typed, no inline fetch
│   │   └── types/
│   │       └── index.ts                  # 🔨 All shared TypeScript interfaces
│   ├── next.config.ts                    # 🔨 output: 'export'
│   ├── tailwind.config.ts                # 🔨 custom dark theme colors
│   └── package.json
│
├── backend/                      # FastAPI uv project
│   ├── app/
│   │   ├── main.py               # 🔨 FastAPI app + lifespan
│   │   ├── db/
│   │   │   ├── connection.py     # 🔨 aiosqlite connection factory
│   │   │   └── init.py           # 🔨 schema creation + seed data
│   │   ├── market/               # ✅ COMPLETE — do not modify
│   │   │   └── ...               # PriceCache, simulator, SSE stream
│   │   ├── portfolio/
│   │   │   ├── router.py         # 🔨 /api/portfolio routes
│   │   │   ├── service.py        # 🔨 trade logic, P&L calc
│   │   │   ├── models.py         # 🔨 Pydantic request/response models
│   │   │   └── db.py             # 🔨 aiosqlite queries
│   │   ├── watchlist/
│   │   │   ├── router.py         # 🔨 /api/watchlist routes
│   │   │   ├── models.py         # 🔨
│   │   │   └── db.py             # 🔨
│   │   ├── chat/
│   │   │   ├── router.py         # 🔨 /api/chat route
│   │   │   ├── service.py        # 🔨 LiteLLM call + action execution
│   │   │   ├── models.py         # 🔨 structured output schema
│   │   │   └── mock.py           # 🔨 LLM_MOCK=true fixture
│   │   ├── health/
│   │   │   └── router.py         # 🔨 GET /api/health
│   │   └── snapshots.py          # 🔨 30s portfolio snapshot background task
│   ├── db/
│   │   └── schema.sql            # 🔨 CREATE TABLE statements
│   ├── tests/
│   │   ├── market/               # ✅ COMPLETE
│   │   ├── test_portfolio.py     # 🔨
│   │   ├── test_watchlist.py     # 🔨
│   │   └── test_chat.py          # 🔨
│   └── pyproject.toml            # ✅ exists — needs aiosqlite + litellm
│
├── test/                         # Playwright E2E
│   ├── docker-compose.test.yml   # 🔨
│   └── specs/
│       └── trading.spec.ts       # 🔨
│
├── db/                           # Runtime volume mount target
│   └── .gitkeep                  # ✅ exists — finally.db written here at runtime
│
├── Makefile                      # 🔨 make start/stop/build/test/logs/clean
├── Dockerfile                    # 🔨 Multi-stage Node 20 → Python 3.12
├── docker-compose.yml            # 🔨 Optional dev convenience wrapper
├── .env.example                  # 🔨 OPENROUTER_API_KEY, MASSIVE_API_KEY, LLM_MOCK
└── .gitignore                    # ✅ exists
```

### Makefile Targets

```makefile
start    # docker build (if needed) + run with volume + .env
stop     # docker stop + rm container
build    # docker build only
logs     # docker logs -f
test     # spin up docker-compose.test.yml, run Playwright, tear down
clean    # stop + remove named volume (destructive — prompts confirmation)
```

### FR-to-Structure Mapping

| FR Category | Backend Module | Frontend Components |
|---|---|---|
| Market streaming (FR1–5) | `app/market/` ✅ | `priceStore`, `useSSE`, `WatchlistPanel` |
| Watchlist (FR6–9) | `watchlist/` | `watchlistStore`, `WatchlistPanel` |
| Chart/detail (FR10–11) | — (prices from cache) | `ChartPanel`, `priceStore` |
| Portfolio & trading (FR12–18) | `portfolio/` | `portfolioStore`, `TradeBar`, `PositionsTable`, `PortfolioHeatmap`, `PnLChart` |
| AI chat (FR19–27) | `chat/` | `ChatPanel` |
| Notifications (FR28–30) | — | `react-hot-toast`, connection status in `Header` |
| History & persistence (FR31–33) | `snapshots.py` + `portfolio/` | `PnLChart` |
| System/ops (FR34–37) | `health/`, lifespan, `Makefile` | — |

### Architectural Boundaries

**API Boundary** — all communication between frontend and backend goes through:
- REST: `src/lib/api.ts` → `/api/*`
- SSE: `useSSE.ts` → `/api/stream/prices`
- No direct DB access from frontend; no business logic in route handlers

**Component Boundary** — each frontend panel is independent:
- Panels read from Zustand stores only — never from sibling components
- `ChatPanel` has its own error boundary — failures cannot cascade
- `priceStore` is the single SSE consumer — all panels read from the store

**Data Boundary** — all price data flows through `PriceCache`:
- `SimulatorDataSource` / `MassiveDataSource` → `PriceCache` → SSE stream → `priceStore`
- Backend business logic (portfolio, chat) reads live prices via `PriceCache.get(ticker)`
- Never read simulator/Massive client output directly

### Data Flow Diagrams

**SSE Price Stream:**
```
SimulatorDataSource ──writes──► PriceCache ──reads──► SSE handler
                                                         │
                                               EventSource (browser)
                                                         │
                                                    useSSE hook
                                                         │
                                                    priceStore
                                                    ╱    │    ╲
                                          WatchlistPanel │  ChartPanel
                                                    sparklines, flash
```

**Manual Trade Path:**
```
TradeBar ──POST /api/portfolio/trade──► portfolio/router.py
                                              │
                                        service.py (validate → execute)
                                              │
                                       aiosqlite writes (positions, trades)
                                              │
                                       inline snapshot recorded
                                              │
                                    200 OK → portfolioStore.refetch()
```

**AI Trade Path:**
```
ChatPanel ──POST /api/chat──► chat/router.py
                                    │
                              service.py: load context → LiteLLM call
                                    │
                              parse structured JSON response
                                    │
                              auto-execute each trade via portfolio/service.py
                                    │
                              store chat_messages + executed actions
                                    │
                         200 OK (message + actions) → portfolioStore.refetch()
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All decisions are mutually reinforcing with no conflicts:
- `aiosqlite` async queries are compatible with FastAPI's async model — no blocking I/O
- Zustand per-ticker selectors eliminate re-render storms at the 500ms SSE cadence
- `lifespan` context manager guarantees market data source starts before first request
- Static Next.js export eliminates SSR/hydration concerns; `StaticFiles(html=True)` cleanly handles SPA fallback
- `openrouter/openrouter/free` model string is hardcoded in `chat/service.py`, never derived from config

**Pattern Consistency:**
- snake_case JSON ↔ snake_case DB columns: zero transform layer, zero divergence risk
- Error envelope `{"error":..., "code":...}` used consistently from `HTTPException` through frontend `ApiError`
- All price reads go through `PriceCache` — SSE stream (built) and chat context builder (to build) follow the same path
- `uv run` / `uv add` rule is unambiguous throughout

**Structure Alignment:**
- Every domain module has `router.py` + `service.py` + `models.py` + `db.py` — no deviation
- Frontend store-per-domain mirrors backend domain modules — clear ownership
- `ChatPanel` error boundary is structurally isolated — failures cannot cascade to siblings

### Requirements Coverage Validation ✅

**FR Coverage (37 FRs, 8 domains):**

| Domain | FRs | Architectural Support |
|---|---|---|
| Market streaming | FR1–5 | ✅ Complete (brownfield) |
| Watchlist | FR6–9 | ✅ `watchlist/` module + `watchlistStore` |
| Chart/detail | FR10–11 | ✅ `priceStore` sparkline buffer + `ChartPanel` |
| Portfolio & trading | FR12–18 | ✅ `portfolio/` module + dual write path |
| AI chat | FR19–27 | ✅ `chat/` module + LiteLLM structured output + mock fixture |
| Notifications | FR28–30 | ✅ `react-hot-toast` + connection status in `Header` |
| History & persistence | FR31–33 | ✅ `snapshots.py` (30s + post-trade) + `PnLChart` |
| System/ops | FR34–37 | ✅ `health/` endpoint + lifespan + `Makefile` + `.env.example` |

**NFR Coverage (14 NFRs):**

| Category | Addressed By |
|---|---|
| sub-100ms price render, no frame drops | Zustand selectors, Canvas charting, SSE push |
| sub-1s trade, non-blocking background | aiosqlite async, lifespan tasks off request path |
| SSE reconnect, LLM isolation | EventSource built-in retry, `ChatPanel` error boundary |
| Clean DB init, state persistence | Lazy init in lifespan, SQLite volume mount |
| API key security | Env var only, never logged or returned |
| Fixed model string, mock mode, API fallback | Hardcoded string, `LLM_MOCK` fixture, env-driven factory |

### Implementation Readiness Validation ✅

**Decision Completeness:** All 6 critical/important decisions documented with rationale and versions. No blocking unknowns.

**Structure Completeness:** Every file marked ✅ (exists) or 🔨 (to create). Integration points named and typed. Boundaries explicit.

**Pattern Completeness:** 8 conflict points identified and resolved. Rules cover DB naming, API naming, Python, TypeScript, React components, Zustand stores, hooks, API client functions, loading state convention, sparkline buffer cap (200 points), and post-trade refetch rule.

### Gap Analysis Results

**Critical Gaps:** None — all implementation-blocking decisions are resolved.

**Important Gaps:** None significant.

**Minor / Nice-to-Have:**
- `npm install zustand` not listed in starter section (agents can infer)
- `aiosqlite` version not pinned — `uv add aiosqlite` resolves to latest (acceptable)
- Playwright container image version left to E2E implementation agent

None of these block implementation.

### Architecture Completeness Checklist

**✅ Requirements Analysis** — context, scale, constraints, cross-cutting concerns mapped

**✅ Architectural Decisions** — DB (aiosqlite), state (Zustand), errors (envelope), background tasks (lifespan), mock mode, static serving

**✅ Implementation Patterns** — naming (DB/API/Python/TS), structure (backend domains, frontend stores/hooks/components), communication (Zustand update rules, api.ts, post-trade refetch), process (error handling, loading state)

**✅ Project Structure** — complete annotated tree, Makefile targets, FR-to-structure mapping, data flow diagrams, architectural boundaries

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level: High**

**Key Strengths:**
- Brownfield market data layer is production-complete — implementation agents start from a working foundation
- Two explicit substitution seams (market source, LLM) are environment-driven and transparent to business logic
- Zero ambiguity on JSON field casing — consistent snake_case eliminates a common multi-agent divergence point
- Both trade paths (trade bar + AI chat) route through `portfolio/service.py` — single source of truth

**Areas for Future Enhancement (post-MVP):**
- Auth / multi-user — schema pre-seeded with `user_id` columns, no migration needed when deferred
- Cloud deployment — Terraform / App Runner config as stretch goal
- WebSocket upgrade — only if bidirectional communication becomes necessary

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented — no local optimizations that contradict these choices
- Use implementation patterns consistently across all components
- Respect project structure and domain boundaries — no cross-domain imports except through defined interfaces
- Refer to this document for all architectural questions before inventing new patterns

**First Implementation Priority:**
```bash
# 1. Initialize frontend
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack

# 2. Add backend dependencies
cd backend && uv add aiosqlite litellm

# 3. Implement DB init module (backend/app/db/)
# 4. Implement remaining API routes (portfolio → watchlist → chat → health)
# 5. Implement frontend Zustand stores + SSE hook
# 6. Implement UI components
# 7. Wire Dockerfile + Makefile
```
