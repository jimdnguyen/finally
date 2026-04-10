---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 02
status: planning
last_updated: "2026-04-10"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 20
---

# State: FinAlly v1.0

**Last updated:** 2026-04-09  
**Current phase:** 01
**Status:** Executing Phase 01

---

## Project Reference

**Core Value:** A Bloomberg-terminal-style UI with streaming live prices and an AI copilot that actually executes trades — showcasing orchestrated AI agents building a real full-stack product end-to-end.

**What's Done:** Market data subsystem (simulator, Massive API client, price cache, SSE endpoint) — 73 passing tests, 84% coverage.

**What's Remaining:** FastAPI app server, SQLite database, all API endpoints, LLM integration, entire frontend UI, Docker container, E2E tests.

---

## Current Position

Phase: 01 (Database & Core API) — EXECUTING
Plan: 1 of 4
**Phase:** 1 of 5 (Database & Core API)

**Focus:** Establish SQLite persistence and foundational REST endpoints.

**Progress:**

```
Phase 1: Database & Core API
████░░░░░░░░░░░░░░░░░░░░░░  0% complete
  Requirements: 10
  Plans: TBD (via /gsd-plan-phase 1)
  Status: Roadmap approved, awaiting planning
```

**Next Action:** `/gsd-plan-phase 1` to decompose Phase 1 into executable plans.

---

## Accumulated Context

### Key Decisions Locked In

1. **Stack:** FastAPI 0.135.3+, Python 3.12, uv package manager; Next.js 15 static export; SQLite 3.x; LiteLLM → OpenRouter → Cerebras
2. **Database:** SQLite with lazy initialization, WAL mode enabled, Decimal precision for all monetary values
3. **API Model:** Market orders only (no limit orders, no order book). Atomic trade execution with `BEGIN IMMEDIATE` + explicit `COMMIT`.
4. **Real-Time:** SSE (Server-Sent Events) for one-way price push; browser auto-reconnect; ~500ms cadence
5. **Frontend:** Next.js static export served by FastAPI on single port (8000); Tailwind CSS dark theme; Zustand + TanStack Query for state
6. **LLM:** Structured outputs via Pydantic v2; OpenRouter detection bug requires LiteLLM override flag

### Critical Pitfalls (Prevention Required)

| Pitfall | Prevention | Phase |
|---------|-----------|-------|
| aiosqlite context manager doesn't commit | Use nested context `async with db: await db.execute()` or explicit `await db.commit()` | 1 |
| LiteLLM OpenRouter detection fails | Set `litellm._openrouter_force_structured_output = True` | 3 |
| Float precision errors in P&L | Use `Decimal` for all monetary values; initialize from strings | 1 |
| SSE connection cleanup | Check `if await request.is_disconnected(): break` before each yield | 4 |
| SQLite threading race conditions | Enable WAL mode + use lock around database writes | 1 |
| Next.js static export: dynamic routes | Pre-generate with `generateStaticParams()` or use query params | 4 |
| Docker: Next.js output path incorrect | Set `distDir: 'out'` in next.config.js; assert with `test -f ./static/index.html` | 5 |
| Docker: uv.lock missing | Commit uv.lock to git; use `uv sync --frozen` in Dockerfile | 5 |

### Design Notes

- **Single User:** All data hardcoded as `user_id="default"` in database schema. Schema supports future multi-user migration without schema changes.
- **Trade Validation:** Buy requires sufficient cash. Sell requires owned shares. Invalid trades rejected with descriptive error; no partial execution.
- **Portfolio Snapshots:** Recorded every 30 seconds (background task) and immediately after each trade execution. Used for P&L chart.
- **LLM Auto-Execution:** Trades from LLM response execute via same validation as manual trades. Failures reported in chat response.
- **Connection Status:** SSE client connection state reflected in header indicator dot (green=connected, yellow=reconnecting, red=disconnected).

### Testing Strategy

1. **Backend Unit Tests (Phase 2):** Trade execution logic (buy/sell validation, atomic update, edge cases)
2. **Backend Unit Tests (Phase 3):** LLM response parsing (schema validation, malformed response handling)
3. **E2E Tests (Phase 5):** Full user flows with Playwright in docker-compose.test.yml; LLM_MOCK=true for determinism

---

## Performance Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Fresh app start → prices streaming | < 5 seconds | TBD |
| Trade execution → portfolio update | < 1 second | TBD |
| LLM chat response | < 5 seconds (Cerebras fast inference) | TBD |
| SSE reconnection | < 2 seconds | TBD |
| ECharts rendering (100K points) | 60fps | TBD |
| Docker build time | < 2 minutes | TBD |

---

## Todos & Blockers

### Pre-Phase 1 Spike (Optional)

- [ ] Verify SQLite WAL mode performance with concurrent reads/writes
- [ ] Test `BEGIN IMMEDIATE` transaction behavior in aiosqlite (or use sqlite3 sync driver)
- [ ] Confirm Decimal precision workflow (initialize from strings, store/retrieve from DB)

### Phase 1

- [ ] Design SQLite schema (users_profile, watchlist, positions, trades, portfolio_snapshots, chat_messages)
- [ ] Implement lazy database initialization with seed data
- [ ] FastAPI app entry point with lifespan context manager
- [ ] Portfolio endpoints: GET /api/portfolio, GET /api/portfolio/history
- [ ] Watchlist endpoint: GET /api/watchlist
- [ ] Health endpoint: GET /api/health
- [ ] Integrate price cache from market data subsystem

### Phase 2

- [ ] Trade endpoint: POST /api/portfolio/trade with validation and atomic execution
- [ ] Portfolio snapshot background task (every 30s + post-trade)
- [ ] Unit tests for trade execution (buy/sell validation, edge cases, atomicity)

### Phase 3

- [ ] LiteLLM setup with OpenRouter override for structured outputs
- [ ] Pydantic schemas for ChatResponse (message + trades + watchlist_changes)
- [ ] Chat endpoint: POST /api/chat with portfolio context, history, auto-execution
- [ ] Mock mode: LLM_MOCK=true returns deterministic response
- [ ] Unit tests for LLM response parsing and trade validation within chat flow

### Phase 4

- [ ] Create Next.js 15 project with TypeScript, Tailwind CSS, static export
- [ ] Zustand store for price stream state
- [ ] TanStack Query hooks for portfolio, watchlist, chat API
- [ ] EventSource client with auto-reconnect
- [ ] Watchlist panel (grid/table with prices, change %, sparklines)
- [ ] Main chart (price-over-time using ECharts)
- [ ] Portfolio treemap/heatmap (P&L-colored, position-weighted)
- [ ] P&L line chart (portfolio value over time)
- [ ] Positions table (sortable, live updates)
- [ ] Trade bar (ticker, quantity, buy/sell buttons)
- [ ] Chat panel (message history, input, loading state, inline confirmations)
- [ ] Header (portfolio value, cash, connection status dot)
- [ ] Price flash animations (green/red fade)
- [ ] Tailwind dark theme with custom colors

### Phase 5

- [ ] Multi-stage Dockerfile (Node → Next.js static, Python → FastAPI)
- [ ] FastAPI static file serving (map Next.js build output)
- [ ] Docker volume for SQLite persistence
- [ ] Start/stop scripts (shell + PowerShell)
- [ ] Backend pytest suite (trade execution, LLM parsing)
- [ ] E2E Playwright tests with docker-compose.test.yml
- [ ] Verify assertions: frontend files, uv.lock, port 8000

---

## Session Continuity

When resuming work on FinAlly:

1. **Check phase:** Always start by confirming current phase from STATE.md and ROADMAP.md
2. **Review blockers:** Scan "Todos & Blockers" section for phase-specific dependencies
3. **Validate stack:** Confirm Python 3.12, uv, Node 20, Next.js 15, FastAPI 0.135.3+ are locked in
4. **Reference research:** Critical pitfalls are documented above; check SUMMARY.md for detailed rationale
5. **Update STATE.md:** After each significant progress, update progress bar and current focus

---

*Project state initialized: 2026-04-09*
