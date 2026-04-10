# Roadmap: FinAlly

**Milestone:** v1.0 — Full AI Trading Workstation  
**Granularity:** Standard  
**Mode:** YOLO  
**Created:** 2026-04-09

## Summary

**5 phases** | **43 pending requirements** | **5 pre-existing (validated)**

FinAlly v1.0 is built in five sequential phases aligned to delivery dependencies. Phase 1 establishes the database and core API foundation. Phases 2–3 add portfolio trading logic and LLM integration. Phase 4 builds the complete frontend UI. Phase 5 packages everything into a Docker container and validates via E2E tests. Total coverage: 100% of v1 requirements mapped.

## Phase Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|-----------------|
| 1 | Database & Core API | SQLite persistence + basic CRUD for portfolio and watchlist | DATA-01–05, PORT-01/03/04, WTCH-01, SYS-01 | 5 |
| 2 | Portfolio Trading | Trade execution with atomic updates and P&L calculations | PORT-02, DATA-05 | 4 |
| 3 | LLM Chat Integration | Conversational trading via OpenRouter structured outputs | CHAT-01–06 | 3 |
| 4 | Frontend UI | Complete Next.js 15 dark-themed terminal interface | UI-01–17, UI-15/16/17 | 5 |
| 5 | Docker & E2E Testing | Multi-stage container, deployment scripts, validated flows | INFRA-01/02/04/05, TEST-01–03 | 4 |

## Phase Details

### Phase 1: Database & Core API

**Goal:** Establish SQLite persistence and foundational REST endpoints for portfolio state, watchlist, and system health.

**Depends on:** Nothing (first phase)

**Requirements:**
- DATA-01: Lazy SQLite initialization with schema and seed data
- DATA-02: Complete schema (users_profile, watchlist, positions, trades, portfolio_snapshots, chat_messages)
- DATA-03: Default seed data (1 user, 10 tickers, $10,000 balance)
- DATA-04: SQLite WAL mode + Decimal precision for monetary values
- PORT-01: `GET /api/portfolio` returns positions, cash, total value, unrealized P&L
- PORT-03: `GET /api/portfolio/history` for P&L chart (portfolio snapshots)
- PORT-04: Atomic trade transaction setup (`BEGIN IMMEDIATE`) with rollback capability
- WTCH-01: `GET /api/watchlist` returns tickers with live prices
- SYS-01: `GET /api/health` for Docker healthcheck
- INFRA-03: SQLite persistence via Docker volume mount

**Plans:**
- [x] 01-01-PLAN.md — Wave 1: Database & dependencies (DATA-01, DATA-02, DATA-03, DATA-04, INFRA-03)
- [x] 01-02-PLAN.md — Wave 2: Portfolio endpoints (PORT-01, PORT-03, PORT-04)
- [x] 01-03-PLAN.md — Wave 3: Watchlist endpoint (WTCH-01)
- [x] 01-04-PLAN.md — Wave 3: Health check endpoint (SYS-01)

**Success Criteria (what must be TRUE when Phase 1 completes):**
1. User can start the app and see $10,000 cash balance with zero positions
2. User can retrieve their current watchlist (10 default tickers) with latest prices
3. Database persists across app restarts — trades, positions, and cash balance survive container stop/start
4. `GET /api/health` returns 200 with status information
5. All monetary calculations use Decimal precision (no IEEE 754 float errors)

**UI hint:** no

**Notes:** Research flags precision handling (Pitfall #3). Initialize Decimal types from strings. Verify WAL mode enables concurrent reads during portfolio snapshot writes.

---

### Phase 2: Portfolio Trading

**Goal:** Enable atomic trade execution with comprehensive validation and portfolio snapshots.

**Depends on:** Phase 1 (database + price cache from market data subsystem)

**Requirements:**
- PORT-02: `POST /api/portfolio/trade` with buy/sell validation, atomic execution, trade log
- DATA-05: Portfolio snapshot background task (every 30s + immediately post-trade)

**Plans:**
- [x] 02-01-PLAN.md — Wave 1: Trade execution endpoint (PORT-02)
- [x] 02-02-PLAN.md — Wave 2: Portfolio snapshot background task (DATA-05)

**Success Criteria (what must be TRUE when Phase 2 completes):**
1. User can buy 10 shares of AAPL; cash decreases by (10 × current_price), position is created
2. User cannot buy 1,000,000 shares without sufficient cash; buy is rejected with clear error
3. User can sell 5 shares of an owned position; position quantity decreases, cash increases
4. User cannot sell more shares than owned; sell is rejected with clear error
5. Portfolio snapshots record total value every 30 seconds and immediately after each trade

**UI hint:** no

**Notes:** Research flags atomic transaction execution (Pitfall #1) and float precision (Pitfall #3). Use `BEGIN IMMEDIATE` + explicit `COMMIT`. Verify trades persist on database restart.

---

### Phase 3: LLM Chat Integration

**Goal:** Enable conversational trading via structured LLM responses with auto-execution.

**Depends on:** Phase 2 (trade execution logic)

**Requirements:**
- CHAT-01: `POST /api/chat` with portfolio context injection + conversation history
- CHAT-02: Pydantic schema validation for structured JSON (message + trades + watchlist_changes)
- CHAT-03: Auto-execute validated trades from LLM response (same validation as manual trades)
- CHAT-04: `LLM_MOCK=true` returns deterministic mock responses for E2E tests
- CHAT-05: Persist conversation history and executed actions to chat_messages table
- CHAT-06: LiteLLM override for OpenRouter structured output detection bug

**Plans:**
- [x] 03-01-PLAN.md — Wave 1: Chat models + test scaffolding (CHAT-02, CHAT-04)
- [x] 03-02-PLAN.md — Wave 2: Chat service + LLM integration + routes (CHAT-01, CHAT-03, CHAT-05, CHAT-06)

**Success Criteria (what must be TRUE when Phase 3 completes):**
1. User sends "Buy 10 AAPL" to chat; LLM responds with structured JSON, trade executes, position is created
2. User sends "What's my portfolio value?"; LLM responds with analysis of current positions, cash, and P&L
3. LLM auto-executes trades that pass validation (sufficient cash/shares) and rejects invalid trades with explanation
4. With `LLM_MOCK=true`, chat returns deterministic mock response without calling OpenRouter
5. Chat message history persists across app restarts with full conversation context

**UI hint:** no

**Notes:** Research flags LiteLLM/OpenRouter detection (Pitfall #2). Test live call to OpenRouter before Phase 4 begins. Verify JSON response parsing robustness (validate before executing trades).

---

### Phase 4: Frontend UI

**Goal:** Deliver complete Next.js 15 single-page application with real-time prices, trading interface, portfolio visualization, and AI chat panel.

**Depends on:** Phases 1–3 (all backend APIs complete; market data subsystem provides SSE stream)

**Requirements:**
- UI-01: Dark terminal aesthetic (Tailwind CSS dark mode)
- UI-02: Single-page desktop-first layout with all panels visible
- UI-03: Header with live portfolio value, cash balance, connection status dot
- UI-04: Watchlist panel (ticker, price, daily change %, sparkline)
- UI-05: Price flash animation (green/red background, ~500ms fade)
- UI-06: Sparkline mini-charts accumulate price history from SSE stream
- UI-07: Click ticker to select and display in main chart
- UI-08: Main chart area (price-over-time line chart for selected ticker)
- UI-09: Portfolio treemap/heatmap (rectangles sized by weight, colored by P&L)
- UI-10: P&L line chart (total portfolio value over time)
- UI-11: Positions table (ticker, qty, avg cost, current price, unrealized P&L, % change)
- UI-12: Trade bar (ticker input, quantity input, Buy/Sell buttons)
- UI-13: AI chat panel (message input, history, loading indicator)
- UI-14: Trade confirmations and watchlist changes appear inline in chat
- UI-15: SSE EventSource client with auto-reconnect; connection status in header
- UI-16: All API calls target same-origin `/api/*` (no CORS)
- UI-17: Zustand store for prices, TanStack Query for portfolio/chat state

**Success Criteria (what must be TRUE when Phase 4 completes):**
1. User opens app and sees watchlist with live streaming prices (green/red flash on change, sparklines fill progressively)
2. User clicks a ticker and main chart displays price-over-time for that ticker
3. User can buy/sell shares via the trade bar; portfolio updates instantly (cash, positions, treemap colors, P&L)
4. User sees portfolio treemap with green (profit) and red (loss) rectangles sized by position weight
5. User opens chat, sends message, receives LLM response, and inline confirmations show executed trades/watchlist changes

**UI hint:** yes

**Notes:** Next.js static export (YOLO mode). Confirm distDir output location post-build. ECharts for charting (canvas-based, handles 100K+ points). EventSource reconnection with jitter for concurrent clients. Tailwind dark theme with custom colors: `#ecad0a` (yellow), `#209dd7` (blue), `#753991` (purple).

---

### Phase 5: Docker & E2E Testing

**Goal:** Package application into single production-ready container and validate end-to-end flows.

**Depends on:** Phases 1–4 (complete frontend + backend)

**Requirements:**
- INFRA-01: Multi-stage Dockerfile (Node 20 → Next.js static, Python 3.12 → FastAPI)
- INFRA-02: FastAPI serves Next.js static export + all `/api/*` routes on port 8000
- INFRA-04: Start/stop scripts (shell + PowerShell)
- INFRA-05: Optional cloud deployment (infrastructure-as-code, stretch goal)
- TEST-01: Backend pytest for trade execution (validation, atomicity, edge cases)
- TEST-02: Backend pytest for LLM response parsing (schema validation, malformed handling)
- TEST-03: E2E Playwright tests (fresh start, buy/sell, chat with mock LLM, SSE resilience)

**Success Criteria (what must be TRUE when Phase 5 completes):**
1. `docker build -t finally .` produces single-container image; `docker run` starts app on port 8000
2. Fresh container start: default watchlist loads, $10k balance shown, prices stream live
3. E2E test: user buys 10 shares of AAPL → cash decreases, position appears in portfolio
4. E2E test: user sends chat "Buy 5 GOOGL" → trade executes, position updates
5. E2E test: disconnect/reconnect SSE → prices resume streaming without gaps; database persists across restart

**UI hint:** no

**Notes:** Multi-stage Dockerfile assertions: `test -f ./static/index.html` (Next.js output), verify `uv.lock` exists. Start scripts idempotent (safe to run multiple times). E2E tests use `docker-compose.test.yml` with LLM_MOCK=true for determinism.

---

## Pre-existing (Validated)

- **MKTD-01 through MKTD-05:** Market data subsystem — SSE endpoint, GBM simulator, Massive API client, thread-safe price cache, environment-driven source selection. Complete and well-tested (73 passing tests, 84% coverage).

---

## Progress Tracking

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database & Core API | 4/4 | Complete | 2026-04-10 |
| 2. Portfolio Trading | 2/2 | Complete | 2026-04-10 |
| 3. LLM Chat Integration | 2/2 | Planning complete | — |
| 4. Frontend UI | 0/? | Not started | — |
| 5. Docker & E2E Testing | 0/? | Not started | — |

---

**Roadmap updated: 2026-04-10**  
**Coverage: 43/43 pending requirements mapped | 5/5 pre-existing validated**
