# FinAlly Project - the Finance Ally

All project documentation is in the `planning` directory.

The key document is PLAN.md included in full below; the market data component has been completed and is summarized in the file `planning/MARKET_DATA_SUMMARY.md` with more details in the `planning/archive` folder. Consult these docs only when required. The remainder of the platform is still to be developed.

@planning/PLAN.md

<!-- GSD:project-start source:PROJECT.md -->
## Project

**FinAlly — AI Trading Workstation**

FinAlly (Finance Ally) is a visually stunning AI-powered trading workstation that streams live market data, enables simulated portfolio trading, and integrates an LLM chat assistant capable of analyzing positions and executing trades via natural language. Built as the capstone for an agentic AI coding course, it demonstrates how orchestrated AI agents can produce a production-quality full-stack application from scratch.

**Core Value:** A Bloomberg-terminal-style UI with streaming live prices and an AI copilot that actually executes trades — together showcasing the full-stack power of orchestrated AI agents building a real product end-to-end.

### Constraints

- **Architecture:** Single Docker container on port 8000 — no docker-compose, no service orchestration
- **Runtime:** Python 3.12 + uv; Node 20 for frontend build stage
- **Database:** SQLite only — no Postgres, no migrations, lazy init on startup
- **API:** Market orders only — no limit orders, no order book
- **Frontend:** Next.js static export (`output: 'export'`) served by FastAPI
- **LLM:** LiteLLM → OpenRouter → Cerebras (`openrouter/openai/gpt-oss-120b`) with structured outputs
- **No auth:** Single default user, hardcoded `user_id="default"`
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Summary
## Languages
- Python 3.12+ - Backend API, market data simulation, LLM integration
- TypeScript - Frontend (Next.js static export, not yet implemented)
- SQL (SQLite) - Database schema and seed data
## Runtime
- Python 3.12+
- Node.js 20+ (for frontend build, not runtime)
- `uv` 0.5.x+ - Python package manager and runner (`backend/`)
- `npm` - Frontend dependencies (frontend not yet scaffolded)
- `backend/uv.lock` - Complete reproducible Python dependency tree (147.6 KB, 38 packages)
- Frontend lockfile: Not yet created (frontend directory empty)
## Frameworks
- FastAPI 0.115.0+ - Web API framework with async support
- Starlette - Underlying HTTP routing and SSE support (implicit via FastAPI)
- Uvicorn 0.32.0+ - ASGI application server with standard extras (HTTP/WebSocket/uvloop)
- pytest 8.3.0+ - Test runner
- pytest-asyncio 0.24.0+ - Async test support (using auto mode)
- pytest-cov 5.0.0+ - Test coverage reporting
- ruff 0.7.0+ - Fast Python linter and formatter
- Configuration: `pyproject.toml` with line-length 100, target Python 3.12, rules: E/F/I/N/W
- Rich 13.0.0+ - Terminal formatting and live UI (used in `market_data_demo.py`)
## Key Dependencies
- `fastapi` 0.115.0+ - REST API and SSE endpoint creation
- `uvicorn[standard]` 0.32.0+ - ASGI server with uvloop support
- `massive` 1.0.0+ - Polygon.io REST client for real market data polling (conditional on `MASSIVE_API_KEY`)
- `numpy` 2.0.0+ - Numeric operations for GBM simulator (Cholesky decomposition)
- `pydantic` (indirect) - Data validation via FastAPI
- `python-dotenv` - Environment variable loading from `.env` file
- `h11` - HTTP/1.1 protocol layer (FastAPI/Uvicorn)
- `anyio` - Async I/O abstraction layer
- `httptools` - HTTP parsing (uvloop optimization)
- `websockets` - WebSocket support (implicit dependency, not used but available)
- `watchfiles` - File watching for dev reload
- `rich` 13.0.0+ - Rich terminal formatting for demo and logging output
- `click` - CLI utilities
- `pyyaml` - YAML parsing (dependency chain)
## Configuration
- Configuration via `.env` file (not version controlled; `.env.example` in repo)
- Loaded via `python-dotenv` in backend startup
- Python path: `PYTHONPATH` includes `backend/` for module imports
- Python project: `backend/pyproject.toml`
- Frontend: Not yet scaffolded (will use `create-vite` with TypeScript template per project docs)
- Database: `db/finally.db` (SQLite file, volume-mounted in Docker)
- Logs: stdout/stderr via Rich console
- No configuration files needed at runtime (all via env vars)
## Platform Requirements
- Python 3.12+ with pip (or use `uv` directly)
- Node.js 20+ (for frontend build when scaffolded)
- SQLite 3+ (bundled with Python)
- Docker (for local containerized testing)
- Multi-stage Dockerfile (planned):
- Single port: 8000
- Database volume mount: `/app/db` maps to `db/finally.db`
- Environment file: `.env` passed via `--env-file` to `docker run`
## Versions Summary
| Component | Version | Notes |
|-----------|---------|-------|
| Python | 3.12+ | Required via pyproject.toml |
| FastAPI | 0.115.0+ | Latest stable, async first |
| Uvicorn | 0.32.0+ | With standard extras (uvloop, httptools) |
| Massive (Polygon.io) | 1.0.0+ | Market data REST client |
| NumPy | 2.0.0+ | For GBM math (Cholesky, random sampling) |
| pytest | 8.3.0+ | Full test suite support |
| ruff | 0.7.0+ | Modern Python linter |
| Node | 20+ | Frontend build (not yet active) |
## Build & Deploy
- Uses Python 3.12 slim base image
- Installs `uv` within container
- Copies `pyproject.toml` and `uv.lock`
- Runs `uv sync` to install dependencies
- Exposes port 8000
- Mounts `db/` volume for SQLite persistence
- Not yet configured in repo
- GitHub Actions available in `.github/workflows/` (added but not configured for this phase)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Summary
## Python Naming Patterns
- Snake_case for filenames: `cache.py`, `simulator.py`, `seed_prices.py`, `massive_client.py`
- Descriptive names that indicate purpose: `interface.py` for abstract contracts, `factory.py` for creation patterns, `models.py` for data structures
- PascalCase: `PriceUpdate`, `PriceCache`, `MarketDataSource`, `GBMSimulator`, `SimulatorDataSource`, `MassiveDataSource`
- Concrete implementations inherit from abstract base or interface: `SimulatorDataSource(MarketDataSource)`
- Internal private attributes prefixed with underscore: `self._prices`, `self._lock`, `self._task`, `self._cholesky`
- Snake_case: `update()`, `get_price()`, `step()`, `get_tickers()`, `_pairwise_correlation()`, `_rebuild_cholesky()`
- Private methods prefixed with single underscore: `_add_ticker_internal()`, `_run_loop()`
- Properties use `@property` decorator: `direction`, `change`, `change_percent`, `version`
- Async methods named clearly with no special prefix: `async def start()`, `async def stop()`, `async def add_ticker()`
- Snake_case for all variables: `ticker`, `price`, `previous_price`, `timestamp`, `cache`, `tickers`, `dt`, `event_probability`
- Descriptive names over abbreviations: `update_interval` not `ui`, `event_probability` not `prob`
- Loop variables stay short when obvious: `for i, ticker in enumerate(self._tickers)`, `for t1, t2 in pairs`
- UPPER_CASE with underscores: `SEED_PRICES`, `TICKER_PARAMS`, `DEFAULT_PARAMS`, `CORRELATION_GROUPS`, `TRADING_SECONDS_PER_YEAR`, `INTRA_TECH_CORR`, `CROSS_GROUP_CORR`
- Documented with type hints: `SEED_PRICES: dict[str, float]`
## Code Style
- Tool: Ruff (formatter + linter unified)
- Line length: 100 characters (`tool.ruff.line-length = 100` in `pyproject.toml`)
- Ignore: Line-too-long in linter (`ignore = ["E501"]`) because formatter handles wrapping
- Standard library first (implicit group)
- Third-party: `import numpy as np`, `from fastapi import ...`
- Local: `from .cache import PriceCache`, relative imports within package
- Organized by Ruff's "I" rule (import sorting)
- Example from `simulator.py`:
- Tool: Ruff
- Rules enabled: `select = ["E", "F", "I", "N", "W"]`
- Run: `uv run ruff check app/ tests/`
- Format: `uv run ruff format app/ tests/`
## Type Hints
- All parameters have explicit types (except `self`)
- Return type annotations on every function
- Examples:
- Use `|` syntax (Python 3.10+): `float | None`, `dict[str, float | None]`
- Not `Optional[]` or `Union[]`
- Always parameterized: `list[str]`, `dict[str, float]`, `set[str]`, not bare `list` or `dict`
- Generics from `typing` available but prefer built-in syntax
## Docstring Conventions
- Required at the top of every file
- One-line summary followed by optional details
- Example from `cache.py`:
- Required, immediately after class declaration
- Describe purpose, lifecycle, and synchronization if relevant
- Example:
- Required for public methods
- Format: one-line summary, then detailed description if complex
- Include parameters and return description for non-obvious cases
- Example from `cache.py`:
- Minimal comments outside docstrings; code should be self-documenting
- Comment when explaining complex math or non-obvious logic
- Example from `simulator.py`:
## Immutability & Frozen Dataclasses
- Uses `@dataclass(frozen=True, slots=True)` from `models.py`
- Immutable snapshot: once created, cannot be modified
- Immutability tested explicitly: `test_immutability` in `test_models.py` verifies `AttributeError` on assignment
- Prevents accidental mutations during concurrent access
## Thread Safety
- Used in `PriceCache` to protect shared state
- All access to `self._prices` dict guarded with `with self._lock:`
- Example:
- Background tasks created with `asyncio.create_task()` with explicit names: `asyncio.create_task(..., name="simulator-loop")`
- Cancellation handled gracefully with try/except `asyncio.CancelledError`
## Error Handling
- Silent no-ops for idempotent operations: `remove_ticker()` does nothing if ticker not present
- Validation on write: `update()` on prices assumes valid float input
- Logging on failure: `SimulatorDataSource._run_loop()` logs and continues on exception
## Logging
- One logger per module: `logger = logging.getLogger(__name__)`
- Located after imports in source file
- Example from `simulator.py`:
- Info level for lifecycle events: `logger.info("Simulator started with %d tickers", len(tickers))`
- Debug for detailed flow: `logger.debug("Random event on %s: %.1f%%", ticker, shock_magnitude * 100)`
- Exception for caught errors: `logger.exception("Simulator step failed")`
## Module Structure
- `models.py` — Data structures (`PriceUpdate`)
- `interface.py` — Abstract contracts (`MarketDataSource`)
- `cache.py` — Concrete implementation of caching
- `simulator.py` — Concrete implementation of market data (GBM-based)
- `massive_client.py` — Concrete implementation of market data (Massive API)
- `factory.py` — Factory function to select implementation
- `stream.py` — SSE streaming router (FastAPI)
- `seed_prices.py` — Configuration data
- `__init__.py` — Public API exports
## Git Commit Conventions
- Format: `type: description` or `type(scope): description`
- Types seen: `feat:`, `chore:`, `fix:`, `docs:`
- Examples from recent commits:
## API Request/Response Convention
## Testing Conventions
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Summary
## System Overview
```
```
## Architectural Pattern
## Market Data Flow
### Architecture
```
```
### Data Sources
- **Backing**: `GBMSimulator` — Geometric Brownian Motion with configurable drift/volatility per ticker
- **Correlation**: Cholesky decomposition of sector-based correlation matrix
- **Random Events**: ~0.1% chance per tick of 2–5% shock move
- **Update Interval**: 500ms (configurable)
- **Lifecycle**: `await source.start(tickers)` spawns background task → `await source.stop()` cancels
- **Backing**: REST polling via `massive` package (Polygon.io)
- **Trigger**: Only created if `MASSIVE_API_KEY` environment variable is set and non-empty
- **Rate**: Free tier 5 calls/min (poll every 15s); paid tiers up to 2–15s
- **Parsing**: REST response mapped to same `PriceUpdate` format as simulator
- `create_market_data_source(price_cache)` inspects `MASSIVE_API_KEY` and returns appropriate source
### PriceCache
- **Key Structure**: `{ticker → PriceUpdate}`
- **PriceUpdate**: Frozen dataclass with computed properties: `change`, `change_percent`, `direction` ("up"/"down"/"flat")
- **Thread Safety**: Lock guards all read/write operations
- **Version Counter**: Monotonically incremented on every update; enables SSE endpoint to detect changes without polling
- **API**:
### SSE Streaming
- **Endpoint**: `GET /api/stream/prices` (text/event-stream)
- **Transport**: Server-Sent Events (SSE) — simpler than WebSockets, one-way push, browser auto-reconnect
- **Payload**: Every 500ms, sends all tickers' `PriceUpdate` as JSON:
- **Change Detection**: Only emits if `price_cache.version` has changed since last send
- **Reconnection**: Includes `retry: 1000` header; browser's `EventSource` auto-reconnects after 1s disconnect
## Trade Execution Flow
### Portfolio State
- `users_profile` — cash balance (default user hardcoded as `"default"`)
- `positions` — holdings: ticker, quantity, avg_cost, updated_at
- `trades` — append-only log: ticker, side (buy/sell), quantity, price, executed_at
- `portfolio_snapshots` — value over time (sampled every 30s + immediately post-trade)
### Trade Endpoint
```json
```
## LLM Integration Flow
### Chat Endpoint
```json
```
- `OPENROUTER_API_KEY` — required; enables LLM chat
- `LLM_MOCK=true` — optional; returns deterministic mock responses for tests
## Watchlist Management
### State
### Endpoints
- `GET /api/watchlist` — fetch tickers with latest prices
- `POST /api/watchlist` — add ticker: `{"ticker": "TSLA"}`
- `DELETE /api/watchlist/{ticker}` — remove ticker
### Subscription Model
## Background Tasks
### Market Data Loop
- Runs continuously in an `asyncio.Task`
- **Simulator**: Every 500ms, calls `GBMSimulator.step()`, writes results to `PriceCache`
- **Massive**: On configurable interval, polls Polygon.io API, updates `PriceCache`
- **Lifecycle**: Started in `source.start()`, cancelled in `source.stop()`
### Portfolio Snapshot Loop
- Samples total portfolio value every 30 seconds
- Records to `portfolio_snapshots` table
- Also triggered immediately after each trade execution
- Used for P&L chart on frontend
## Key Design Decisions
| Decision | Rationale |
|----------|-----------|
| **Market Data Abstraction** | `MarketDataSource` interface allows swapping simulator ↔ Massive without touching SSE, portfolio, or chat code |
| **PriceCache as Source of Truth** | Single in-memory point of truth; thread-safe, version-tracked for SSE efficiency |
| **SSE over WebSockets** | One-way push is all we need; simpler, no bidirectional state, universal browser support, built-in reconnection |
| **Trade Auto-Execution by LLM** | Zero-cost sandbox (simulated money) + impressive demo + demonstrates agentic AI; all with same validation as manual trades |
| **SQLite with Lazy Init** | No separate migration tool; backend auto-creates schema + seed data on first request if DB is missing |
| **Static Next.js Export** | No CORS, single origin, single port, single Docker container; FastAPI serves both frontend and APIs |
| **Structured Output (LLM)** | Deterministic JSON parsing; no token streaming needed (Cerebras inference is fast); clear separation of message vs. actions |
## Dependency Injection
```python
```
## Error Handling
- **Market data errors**: Logged, backoff retry on next interval
- **Trade validation**: HTTP 400 with reason (insufficient cash, non-existent ticker, etc.)
- **SSE disconnection**: Browser auto-reconnects via `EventSource`; server logs disconnect
- **LLM errors**: Caught and returned to user via chat message; trade validation failures included in response
## Scaling Considerations
### Current Limits
- **Single-User**: All user data hardcoded as `"default"` in database
- **Tickers**: ~50 (correlation matrix is O(n²), not a bottleneck)
- **Concurrent SSE Connections**: Limited by Python event loop (hundreds reasonable; FastAPI + uvicorn handles thousands in practice)
### Path to Multi-User
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| cerebras | Use this skill when writing code that calls an LLM through LiteLLM and OpenRouter in this project. This project only allows `openrouter/free`, with Cerebras set as the preferred inference provider. Covers setup, Structured Outputs, and streaming logic for both standard-model and reasoning-model behaviors that `openrouter/free` can return. | `.claude/skills/cerebras/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
