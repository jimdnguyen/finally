# Codebase Structure

**Last updated: 2026-04-09**

## Summary

FinAlly is organized as a monorepo with separate frontend (Next.js, currently empty) and backend (FastAPI/Python/uv) directories. The backend contains the market data subsystem (complete), PostgreSQL-agnostic schema definitions, and placeholder routers for portfolio/chat/watchlist. Frontend is to be implemented. All project documentation lives in `planning/`, and GSD (Get-Shit-Done) agent tooling lives in `.claude/`.

## Top-Level Directory Layout

```
finally/
├── .claude/                    # GSD orchestration framework (agent tooling)
├── .github/                    # GitHub Actions CI/CD workflows
├── .planning/                  # GSD-generated codebase analysis documents
│   └── codebase/               # ARCHITECTURE.md, STRUCTURE.md, etc.
├── backend/                    # FastAPI application (Python/uv)
│   ├── app/                    # Application code
│   ├── tests/                  # Unit and integration tests
│   ├── pyproject.toml          # uv project config
│   ├── uv.lock                 # Lockfile (deterministic Python deps)
│   └── CLAUDE.md               # Backend developer guide
├── frontend/                   # Next.js application (TypeScript, currently empty)
├── planning/                   # Project-wide documentation
│   ├── PLAN.md                 # Master specification (all agents read this)
│   ├── MARKET_DATA_SUMMARY.md  # Completed market data subsystem summary
│   └── archive/                # Historical design docs and reviews
├── test/                       # Playwright E2E tests
│   └── test-results/           # E2E test reports
├── db/                         # Runtime SQLite data directory
│   └── .gitkeep                # finally.db created here by backend at runtime
├── scripts/                    # Start/stop helper scripts (to be created)
├── .env                        # Environment variables (gitignored, contains secrets)
├── .env.example                # Template for .env (committed)
├── .gitignore
├── Dockerfile                  # Multi-stage build (Node 20 → Python 3.12)
├── docker-compose.yml          # Optional convenience wrapper
├── CLAUDE.md                   # Project-level instructions
└── README.md                   # User-facing intro
```

## Backend Directory Structure

```
backend/
├── app/                        # Main application package
│   ├── __init__.py            # Package marker
│   ├── main.py                # FastAPI app factory (to be created)
│   ├── db.py                  # Database initialization (to be created)
│   ├── market/                # Market data subsystem (COMPLETE)
│   │   ├── __init__.py        # Public API exports
│   │   ├── interface.py       # MarketDataSource abstract base class
│   │   ├── models.py          # PriceUpdate dataclass
│   │   ├── cache.py           # PriceCache (thread-safe store)
│   │   ├── seed_prices.py     # Realistic seed prices + per-ticker GBM params
│   │   ├── simulator.py       # GBMSimulator + SimulatorDataSource
│   │   ├── massive_client.py  # MassiveDataSource (REST polling)
│   │   ├── factory.py         # create_market_data_source() factory
│   │   └── stream.py          # create_stream_router() for SSE endpoint
│   ├── portfolio/             # Portfolio APIs (to be created)
│   │   ├── __init__.py
│   │   ├── models.py          # Trade, Position dataclasses
│   │   └── router.py          # /api/portfolio/* endpoints
│   ├── chat/                  # LLM chat APIs (to be created)
│   │   ├── __init__.py
│   │   └── router.py          # /api/chat endpoint
│   └── watchlist/             # Watchlist APIs (to be created)
│       ├── __init__.py
│       └── router.py          # /api/watchlist/* endpoints
├── tests/                     # Test suite (pytest)
│   ├── __init__.py
│   ├── conftest.py            # Shared fixtures
│   └── market/                # Market data tests (COMPLETE, 73 passing tests)
│       ├── __init__.py
│       ├── test_models.py
│       ├── test_cache.py
│       ├── test_simulator.py
│       ├── test_simulator_source.py
│       ├── test_factory.py
│       └── test_massive.py
├── market_data_demo.py        # Demo: Rich terminal dashboard (optional, educational)
├── pyproject.toml             # uv project config: FastAPI, uvicorn, numpy, massive, rich
├── uv.lock                    # Deterministic lockfile (committed to repo)
├── README.md                  # Backend setup & API reference (to be created)
├── CLAUDE.md                  # Backend developer guide
├── .venv/                     # Python virtual environment (gitignored)
└── db/                        # (Symlink or shared with root db/)
    └── .gitkeep               # finally.db created here at runtime
```

## Frontend Directory Structure

**Currently empty.** Once initialized with Next.js:

```
frontend/
├── app/                       # Next.js app directory (or pages/ for legacy)
│   ├── page.tsx               # Root page (single SPA layout)
│   └── layout.tsx             # Root layout
├── components/                # React components
│   ├── layout/                # Header, sidebar, charts
│   ├── market/                # Watchlist, price ticker
│   ├── portfolio/             # Heatmap, P&L chart, positions table
│   ├── chat/                  # Chat panel, message list
│   └── trade/                 # Trade form (buy/sell buttons)
├── lib/                       # Utilities
│   ├── api.ts                 # Fetch wrapper for /api/* calls
│   ├── sse.ts                 # EventSource wrapper for SSE prices
│   └── types.ts               # Shared TypeScript types
├── styles/                    # Global CSS (Tailwind config)
├── public/                    # Static assets (icons, fonts)
├── next.config.js             # Config: output: 'export' for static build
├── tailwind.config.ts         # Tailwind with dark theme customization
├── tsconfig.json              # TypeScript config
├── package.json               # npm dependencies
└── package-lock.json
```

**Build Output**: `out/` — static export, copied into Docker image and served by FastAPI at `/`

## Database Schema

**Location**: `backend/app/db/` (to be created; SQL files):
- `schema.sql` — Table definitions with `user_id` column (future multi-user support)
- `seed.sql` — Default data: 10-ticker watchlist, $10k user balance

**Tables** (created lazily by backend on first request):
- `users_profile` — user ID, cash balance, created_at
- `watchlist` — ticker watched by user, added_at
- `positions` — user holdings: ticker, quantity, avg_cost
- `trades` — append-only log: ticker, side, quantity, price, executed_at
- `portfolio_snapshots` — portfolio total value over time for P&L chart
- `chat_messages` — conversation history: role, content, actions (JSON)

**All tables**: Default `user_id="default"` (single-user model; schema ready for multi-user)

## Configuration Files

| File | Purpose |
|------|---------|
| `backend/pyproject.toml` | Python dependencies (FastAPI, uvicorn, numpy, massive, rich) + pytest config + ruff linting |
| `backend/uv.lock` | Deterministic Python lockfile (committed, reproducible builds) |
| `frontend/next.config.js` | Next.js config (static export, build output) |
| `frontend/tsconfig.json` | TypeScript configuration |
| `frontend/tailwind.config.ts` | Tailwind CSS with custom dark theme colors |
| `.env` | Environment variables (gitignored, must contain `OPENROUTER_API_KEY`) |
| `.env.example` | Template `.env` (committed, guides setup) |
| `Dockerfile` | Multi-stage: Node 20 (frontend build) → Python 3.12 slim (backend runtime) |
| `docker-compose.yml` | Optional convenience wrapper (not required) |

## Test Organization

### Backend Unit Tests

**Location**: `backend/tests/market/`

**Test Modules**:
- `test_models.py` — `PriceUpdate` immutability, properties (change, change_percent, direction)
- `test_cache.py` — `PriceCache` thread-safety, version counter, CRUD operations
- `test_simulator.py` — `GBMSimulator` GBM math, correlation, add/remove ticker, random events
- `test_simulator_source.py` — `SimulatorDataSource` async lifecycle (start/stop), background task
- `test_factory.py` — `create_market_data_source()` selection logic based on env var
- `test_massive.py` — `MassiveDataSource` REST polling, response parsing, retries

**Coverage**: 73 tests, 84% overall coverage (market module 98%+)

**Run Tests**:
```bash
cd backend
uv run --extra dev pytest -v
uv run --extra dev pytest --cov=app
uv run --extra dev ruff check app/ tests/
```

### E2E Tests

**Location**: `test/`

**Playwright tests** (to be implemented):
- Fresh start: default watchlist, prices streaming, $10k balance
- Watchlist CRUD: add/remove tickers
- Trade execution: buy/sell, portfolio updates
- AI chat: send message, receive response, trades auto-execute
- SSE resilience: disconnect and reconnect

**Infrastructure**: `docker-compose.test.yml` spins up app + Playwright container

**Environment**: `LLM_MOCK=true` for fast, deterministic E2E tests (no real API calls)

## Key File Locations

### Market Data Subsystem

| File | Purpose |
|------|---------|
| `backend/app/market/interface.py` | `MarketDataSource` abstract base class |
| `backend/app/market/models.py` | `PriceUpdate` immutable dataclass |
| `backend/app/market/cache.py` | `PriceCache` thread-safe store |
| `backend/app/market/simulator.py` | `GBMSimulator` (Geometric Brownian Motion) + `SimulatorDataSource` |
| `backend/app/market/massive_client.py` | `MassiveDataSource` (REST polling via Massive) |
| `backend/app/market/factory.py` | `create_market_data_source()` — selects simulator or Massive |
| `backend/app/market/stream.py` | `create_stream_router()` — SSE `/api/stream/prices` endpoint |
| `backend/app/market/seed_prices.py` | Seed prices, per-ticker GBM params, correlation groups |
| `backend/market_data_demo.py` | Interactive Rich terminal demo (optional) |

### Tests

| File | Purpose |
|------|---------|
| `backend/tests/conftest.py` | Shared pytest fixtures |
| `backend/tests/market/*.py` | 6 test modules, 73 passing tests |

### Configuration & Documentation

| File | Purpose |
|------|---------|
| `planning/PLAN.md` | Master specification (all agents read this) |
| `planning/MARKET_DATA_SUMMARY.md` | Market data subsystem completion summary |
| `backend/CLAUDE.md` | Backend developer guide: setup, APIs, running tests |
| `CLAUDE.md` | Project-level instructions |
| `.env.example` | Template for environment variables |

## Where to Add New Code

### New Backend Feature/Module

1. **Create directory under `backend/app/`**: e.g., `backend/app/accounts/`
2. **Structure**: `__init__.py` (public API), `models.py` (dataclasses), `router.py` (FastAPI endpoints)
3. **Tests**: `backend/tests/accounts/test_*.py`
4. **Example**: `backend/app/portfolio/` for trade execution
   ```python
   # backend/app/portfolio/__init__.py
   from .models import Trade, Position
   from .router import create_portfolio_router
   __all__ = ["Trade", "Position", "create_portfolio_router"]
   ```

### New Frontend Component

1. **Create file under `frontend/components/`**: e.g., `frontend/components/market/TickerGrid.tsx`
2. **Use React functional components with TypeScript**
3. **API calls via utility**: `frontend/lib/api.ts`
4. **Styling**: Tailwind classes; custom dark theme colors in `tailwind.config.ts`
5. **Example**: Watchlist grid component
   ```typescript
   // frontend/components/market/WatchlistGrid.tsx
   import { useEffect, useState } from 'react';
   import { fetchWatchlist } from '@/lib/api';
   
   export default function WatchlistGrid() {
     const [tickers, setTickers] = useState([]);
     useEffect(() => { /* fetch and render */ }, []);
     // ...
   }
   ```

### New Test

**Backend (pytest)**:
```bash
# Add test under backend/tests/feature/
# Run with: uv run --extra dev pytest -v
```

**Frontend (React Testing Library or similar)**:
```bash
# Add test alongside component or in frontend/tests/
# Run with: npm test
```

## Naming Conventions

### Files

- **Python**: `snake_case.py` — modules, test files
  - Tests: `test_*.py` (pytest auto-discovery)
  - Examples: `market_data_demo.py`, `app/market/cache.py`
- **TypeScript/React**: `PascalCase.tsx` (components), `camelCase.ts` (utilities)
  - Components: `WatchlistGrid.tsx`, `PriceFlash.tsx`
  - Utilities: `api.ts`, `sse.ts`, `types.ts`

### Directories

- **Python**: `snake_case/` — packages, test suites
  - Examples: `backend/app/market/`, `backend/tests/market/`
- **TypeScript/React**: `lowercase/` or `camelCase/`
  - Examples: `frontend/components/`, `frontend/lib/`, `frontend/styles/`

### Python Naming

- **Classes**: `PascalCase` — interfaces, models, exceptions
  - Examples: `MarketDataSource`, `PriceUpdate`, `PriceCache`
- **Functions**: `snake_case` — module-level, internal
  - Examples: `create_market_data_source()`, `_pairwise_correlation()`
- **Constants**: `UPPER_SNAKE_CASE` — module-level configuration
  - Examples: `SEED_PRICES`, `DEFAULT_DT`, `CORRELATION_GROUPS`

### TypeScript Naming

- **Types/Interfaces**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE` (rarely used; prefer `const` with `camelCase`)

## Special Directories

### `.claude/` — GSD Orchestration Framework

Contains the Get-Shit-Done agent tooling:
- `.claude/commands/gsd/` — Agent command definitions
- `.claude/skills/` — Reusable skills (e.g., `cerebras/` for LLM)
- `.claude/get-shit-done/` — Framework templates, workflows, contexts

**Not part of application code.**

### `.planning/codebase/` — GSD Codebase Analysis

Auto-generated by `/gsd-map-codebase` command:
- `ARCHITECTURE.md` — System design, data flow, patterns
- `STRUCTURE.md` — This document
- `STACK.md` — Technology stack (optional focus)
- `CONVENTIONS.md` — Code style, naming (optional focus)
- `TESTING.md` — Test patterns (optional focus)
- `CONCERNS.md` — Technical debt, issues (optional focus)

**Read-only for human developers; consumed by `/gsd-plan-phase` and `/gsd-execute-phase`.**

### `planning/` — Project Documentation

Canonical source of truth for agents:
- `PLAN.md` — Master specification (all agents read this)
- `MARKET_DATA_SUMMARY.md` — Market data subsystem summary
- `archive/` — Historical design docs and code reviews

### `db/` — Runtime SQLite Directory

- Created empty at project root (`db/.gitkeep`)
- At runtime, `finally.db` is created here by the backend
- Volume-mounted in Docker; persists across container restarts
- Gitignored (data, not code)

### `test/` — E2E Tests

- Playwright tests and test infrastructure
- `docker-compose.test.yml` for running tests in isolation
- Test results in `test-results/`

---

**Structure analysis: 2026-04-09**
