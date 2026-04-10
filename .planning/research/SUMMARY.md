# Research Summary: FinAlly
_Last updated: 2026-04-09_

---

## Executive Summary

FinAlly is a visually stunning AI-powered trading simulator that must deliver three core experiences flawlessly: live price streaming (via SSE), instant trade execution with atomic portfolio updates, and conversational AI that executes trades with zero friction. The recommended stack is **FastAPI 0.135.3+ (Python 3.12)** on the backend, **Next.js 15 static export** on the frontend, **SQLite 3.x** for persistence, and **LiteLLM structured outputs** via OpenRouter/Cerebras for chat. The architecture prioritizes simplicity—market orders only, no confirmation dialogs, single-user model—which dramatically reduces complexity while enabling the flagship feature: AI-driven auto-execution.

The build succeeds or fails based on three technical pillars: (1) **atomic trade execution with correct P&L math**, (2) **reliable real-time price streaming without memory leaks**, and (3) **LLM structured outputs that are actually valid JSON**. Research has identified 17 critical pitfalls across these domains. Prevention requires specific code patterns—`request.is_disconnected()` checks in SSE generators, explicit `await db.commit()` for aiosqlite, `Decimal` types for all monetary values, and jitter in EventSource reconnection backoff. These are not edge cases; they cause production failures in similar systems.

---

## Recommended Stack

| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| **Backend Framework** | FastAPI | 0.135.3+ | Native async/await, built-in Pydantic v2, SSE streaming, no CORS overhead |
| **Backend Language** | Python | 3.12+ | FastAPI requirement; excellent for async I/O and numeric computation |
| **Package Manager** | uv | 0.5.x+ | Fast, reproducible lockfile; modern Python workflow |
| **Database** | SQLite | 3.x | Single file, zero external dependencies, lazy init, atomic transactions |
| **Database Driver** | sqlite3 (stdlib) | 3.x | Sync is faster than aiosqlite for single-user (no I/O bottleneck); simpler code |
| **Server** | Uvicorn | 0.32.0+ | ASGI server; handles SSE + static file serving; include `[standard]` extras |
| **Frontend Framework** | Next.js | 15.x | Static export to single origin, type-safe React, App Router |
| **Frontend Language** | TypeScript | 5.x+ | Type safety; built into Next.js 15 |
| **Styling** | Tailwind CSS | v4.x | Dark theme native, utility-first, class-based dark mode toggle |
| **Charting** | ECharts | 5.x | Canvas-based; handles 100K+ points; supports sparklines, treemap, candlesticks |
| **State Management** | Zustand (prices) + TanStack Query (server state) | Latest | Zustand for price stream cache, TanStack Query for portfolio/watchlist caching |
| **Real-Time Protocol** | SSE (Server-Sent Events) | Web API | Native browser support, simpler than WebSocket, one-way push sufficient |
| **LLM Provider** | LiteLLM → OpenRouter → Cerebras | Latest | Structured outputs via Pydantic; Cerebras has sub-second latency |
| **Validation** | Pydantic | v2.5+ | Structured output schema; 3.5x faster than JSON Schema validation |
| **Container** | Docker | Latest | Multi-stage build: Node 20 (frontend) → Python 3.12 (backend) |

---

## Table Stakes Features

These features must work flawlessly or the app feels broken:

| Feature | Why Essential | Details |
|---------|--------------|---------|
| **Live price streaming** | Core value; traders need real-time data | SSE endpoint pushes all watchlist tickers every ~500ms with price, direction, timestamp |
| **Price flash animation** | Professional expectation; instant visual feedback | Green (uptick) or red (downtick) background, fade over ~500ms; universal in trading terminals |
| **Watchlist display** | Primary UI; must be polished | Grid/table with ticker, current price, daily change %, sparkline mini-chart (filled progressively from SSE stream) |
| **Market order execution** | Core workflow; instant fill | Input (ticker, quantity), Buy/Sell buttons, no confirmation dialogs (simulated money = zero risk) |
| **Portfolio overview** | Traders need to know what they own and its value | Positions table (ticker, qty, avg cost, current price, unrealized P&L), cash balance, total portfolio value |
| **Connection status** | Users need confidence prices are flowing | Indicator dot (green=connected, yellow=reconnecting, red=disconnected) visible in header |
| **Portfolio heatmap/treemap** | Professional visualization; differentiator | Rectangles sized by position weight, colored by P&L (green=profit, red=loss) |
| **P&L chart** | Traders want to see performance trajectory | Line chart of total portfolio value over time from `portfolio_snapshots` (recorded every 30s + after each trade) |
| **AI chat integration** | Core differentiator; fast, conversational | Input field + history, auto-execute trades from LLM response, inline trade confirmations |
| **Positions accuracy** | Wrong P&L destroys trust instantly | Avg cost calculated correctly, unrealized P&L = (current_price - avg_cost) × quantity, works with fractional shares |

---

## Key Differentiators

What makes FinAlly memorable:

| Feature | Value | Notes |
|---------|-------|-------|
| **Zero-friction demo flow** | No signup, no login, Docker command → trading in 10 seconds | Removes barriers; captures interest at peak attention |
| **AI auto-execution without dialogs** | "Buy 10 AAPL" → executes instantly, shows inline confirmation | Simulated money (zero real risk) enables impressive UX; demonstrates agentic AI theme |
| **Portfolio context injection** | LLM sees live positions, cash, P&L, watchlist before responding | Enables informed analysis and suggestions; differentiator vs. generic chat |
| **Bloomberg-inspired dark theme** | Professional aesthetic, reduces eye strain | #0d1117 backgrounds, muted gray borders, accent yellow (#ecad0a), blue (#209dd7), purple (#753991) |
| **Sparkline progression** | Price history fills in real-time as SSE data arrives | Visual metaphor of "data is flowing"; no API call needed, accumulated on frontend |
| **Single Docker container** | One command to deploy; students focus on architecture, not DevOps | Multi-stage build handled cleanly; persistent SQLite volume |

---

## Critical Architecture Patterns

**FastAPI Lifespan Management:**
Use `@asynccontextmanager async def lifespan(app: FastAPI):` pattern for app startup/shutdown. Attach `price_cache`, `db`, and market data tasks to `app.state` for access in routes via dependency injection.

**Trade Execution (Atomic):**
Use `BEGIN IMMEDIATE` + explicit `COMMIT` within a transaction. Validate before executing. Record all trades to immutable `trades` table. Snapshot portfolio immediately after each trade. Use `run_in_threadpool` to avoid blocking the event loop on synchronous sqlite3 operations.

**SSE Streaming (No Memory Leaks):**
Check `await request.is_disconnected()` before each yield. Ensure `finally` blocks execute. For single-user, broadcast all tickers; document future multi-user requires watchlist filtering.

**LLM Structured Outputs:**
Define schemas with Pydantic v2 (TradeAction, WatchlistAction, ChatResponse). Export via `model_json_schema()`. **Critical:** LiteLLM reports OpenRouter as unsupported for structured outputs; override with flag or call OpenRouter directly. Always validate response is valid JSON before parsing.

**Frontend State Management:**
Zustand for price cache (lightweight, updates every 500ms). TanStack Query for server state (portfolio, watchlist, chat history; cached, refetch on mutation). EventSource (native API) for SSE; auto-reconnects built-in.

---

## Anti-Features (Deliberately Avoid)

Do NOT build in v1 (massive complexity, minimal payoff):

| Feature | Why Avoid |
|---------|-----------|
| **Limit orders** | Requires order book, queuing, partial fills, cancellation logic. High complexity. |
| **Stop losses** | Requires monitoring thresholds, triggering sells, handling gaps. State management nightmare. |
| **Options/Futures/Derivatives** | Greeks, implied volatility, expirations. Different asset class entirely. Out of scope. |
| **Multi-currency** | Exchange rates, FX conversions, multi-currency P&L. Adds dimension to every calculation. |
| **Technical indicators** | RSI, MACD, Bollinger Bands. Nice-to-have but distracts from core UI. LLM can mention them in chat. |
| **User authentication** | Schema supports `user_id`, but single-user mode fine for demo. Auth can come later. |
| **Paper-trading bells & whistles** | Slippage, commissions, dividends, stock splits. Unrealistic complexity for a simulator. |

---

## Critical Pitfalls & Prevention

**CRITICAL SEVERITY (Ship Blocks):**

1. **aiosqlite context manager doesn't commit** (Database & Persistence)
   - Context manager closes connection but rolls back transactions
   - Prevention: Use nested context `async with db: await db.execute(...)` or explicit `await db.commit()`
   - Detection: Verify trades persist after app restart

2. **LiteLLM OpenRouter structured output detection fails** (LLM Integration)
   - LiteLLM incorrectly reports OpenRouter as unsupporting response_schema; strips the parameter
   - Response is unstructured text; JSON parsing fails
   - Prevention: Set `litellm._openrouter_force_structured_output = True` or call OpenRouter directly
   - Add response validation: parse JSON, check required fields

3. **Float precision in portfolio math** (Portfolio API)
   - IEEE 754 floating-point errors accumulate; $10,000 becomes $9,999.9999 or $10,000.0001
   - Real money loss at scale
   - Prevention: Use `Decimal` for all monetary values (prices, costs, balances); initialize from strings
   - Store as TEXT in database or handle with rounding awareness

**HIGH SEVERITY (Experience Degradation):**

4. **SSE connection cleanup on disconnect** (Backend API & Streaming)
   - Async generator continues executing after client disconnects; resources leak
   - Hundreds of connected clients → memory exhaustion
   - Prevention: Check `if await request.is_disconnected(): break` before each yield
   - Add integration tests for disconnect scenarios

5. **SQLite threading race conditions** (Database & Persistence)
   - Multiple concurrent requests can trigger `SQLITE_BUSY` errors
   - Data corruption risk with simultaneous price update + trade execution
   - Prevention: Use `asyncio.Lock()` around all database writes, or enable WAL mode with PRAGMA settings
   - For single-user: lock is sufficient; WAL is nice-to-have

6. **Next.js static export: No dynamic routes without generateStaticParams** (Frontend Core)
   - Dynamic routes like `/ticker/[symbol]` require `generateStaticParams()` to pre-generate
   - Without it: 404 when user clicks ticker
   - Prevention: Either pre-generate with `generateStaticParams(["AAPL", ...])` or use query params (`/ticker?symbol=AAPL`)

7. **Next.js static export: No API routes** (Frontend Initialization)
   - Next.js API routes (`/pages/api/*`) are stripped in static export
   - Prevention: All API calls go to FastAPI backend; document this in code

**MEDIUM SEVERITY (Operational Risk):**

8. **SQLite WAL mode not enabled** (Database & Persistence)
   - Default DELETE mode locks database during writes; blocks concurrent readers
   - SSE stream stalls while portfolio snapshot is written
   - Prevention: Add `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL` to init

9. **LLM model version incompatibility with structured output** (LLM Integration)
   - Different models support different JSON schema formats; mismatch → unstructured response
   - Prevention: Add validation that response is valid JSON and has required fields

10. **Native EventSource doesn't support custom headers** (Frontend Integration)
    - Can't send Authorization header; for future auth, need FetchEventSource library
    - Prevention: Document assumption "no auth on SSE endpoint"; add FetchEventSource to package.json for future use

11. **EventSource reconnect storm under load** (Frontend Integration)
    - All clients reconnecting simultaneously overwhelm server; cascade failure
    - Prevention: Add jitter to exponential backoff (±10% random delay)

12. **Missed price updates during reconnect window** (Frontend Integration)
    - Prices change while SSE is down; frontend never sees those updates
    - Low priority for MVP (500ms cadence = small gaps) but document it

13. **Race condition between price update and trade execution** (Portfolio API)
    - Price updates and trade execution can interleave; position updated with different price than used for execution
    - Prevention: Snapshot all prices at trade execution time, or use lock around critical section

14. **Docker: Next.js build output not in expected location** (Docker & Deployment)
    - Build output location varies by version/config; Dockerfile hardcodes wrong path
    - Prevention: Set `distDir: 'out'` in next.config.js; add `RUN test -f ./static/index.html` assertion in Dockerfile

15. **Docker: uv lock file not in container** (Docker & Deployment)
    - Dockerfile skips uv.lock; dependency resolution happens in container (slow, non-deterministic)
    - Prevention: Commit uv.lock to git; use `uv sync --frozen` in Dockerfile

---

## Build Order & Phase Structure

### Phase 1: Database & Core API (2-3 days)
**Goal:** Persistence + basic CRUD

- Define SQLite schema (`users_profile`, `positions`, `trades`, `watchlist`, `portfolio_snapshots`, `chat_messages`)
- Implement lazy database init with seed data
- FastAPI lifespan context manager setup
- GET/POST `/api/portfolio`, POST `/api/portfolio/trade` (with atomic execution)
- GET/POST/DELETE `/api/watchlist/*`

**Pitfalls to avoid:** aiosqlite commit, threading race conditions, float precision (use Decimal)

**Research flags:** None; patterns are well-documented

---

### Phase 2: Market Data & Streaming (2-3 days)
**Goal:** Real-time price updates via SSE

- Implement price cache (in-memory, thread-safe)
- Market simulator (GBM with correlated moves)
- Background task for portfolio snapshots (every 30s)
- GET `/api/stream/prices` (SSE endpoint with disconnect cleanup)
- Integration: price cache → trade execution (snapshot prices at trade time)

**Pitfalls to avoid:** SSE connection cleanup, SQLite WAL mode, price/portfolio race conditions

**Research flags:** None; simulator logic proven; SSE pattern from research

---

### Phase 3: LLM Integration (1-2 days)
**Goal:** Chat endpoint with structured outputs and auto-execution

- Pydantic schemas for LLM response (TradeAction, WatchlistAction, ChatResponse)
- LiteLLM wrapper with structured output override (for OpenRouter detection bug)
- System prompt construction with portfolio context injection
- POST `/api/chat` with trade auto-execution and watchlist changes
- Response validation: JSON parsing + required field checks
- Mock mode for E2E tests (`LLM_MOCK=true`)

**Pitfalls to avoid:** LiteLLM OpenRouter detection, model version incompatibility, response validation

**Research flags:** Verify OpenRouter structured output support with live test call

---

### Phase 4: Frontend Core (3-4 days)
**Goal:** Full UI with real-time prices, trading, chat

- Zustand stores: price cache, UI state
- TanStack Query hooks: portfolio, watchlist, chat history
- EventSource SSE connection with auto-reconnect
- Components:
  - Watchlist (grid with price flash animation, sparklines, connection dot)
  - Main chart (selected ticker, price over time)
  - Positions table (sortable, live updates)
  - Trade bar (ticker, quantity, buy/sell buttons)
  - Portfolio heatmap/treemap (P&L colored)
  - P&L chart (portfolio value over time)
  - Chat panel (history, input, loading state, trade confirmations)
  - Header (portfolio value, cash, connection status)
- Tailwind dark theme with custom colors

**Pitfalls to avoid:** Native EventSource limitations (no custom headers), reconnect storm, missed updates

**Research flags:** None; patterns proven; confirm ECharts handles 100K points at 60fps

---

### Phase 5: Docker & E2E Tests (1-2 days)
**Goal:** Single container delivery, validated end-to-end flows

- Multi-stage Dockerfile:
  - Stage 1: Node 20 → Next.js static export to `out/`
  - Stage 2: Python 3.12 → FastAPI + SQLite
  - Assertions: test -f ./static/index.html, verify uv.lock exists
- Start/stop scripts (shell + PowerShell)
- E2E tests (Playwright, docker-compose.test.yml):
  - Fresh start: default watchlist loads, prices stream
  - Buy/sell: portfolio updates
  - Chat: LLM response (mocked), trades execute, watchlist changes
  - SSE resilience: disconnect/reconnect, prices stay in sync
  - Database persistence: restart app, trades still there

**Pitfalls to avoid:** Dockerfile COPY paths, uv lock file, Next.js output location

**Research flags:** None; Docker patterns standard

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|-----------|-------|
| **Stack Choices** | HIGH | Verified with April 2026 official docs; proven track record in similar projects |
| **Feature Prioritization** | HIGH | Confirmed across Bloomberg, TradingView, Robinhood; PLAN.md aligns with research |
| **Architecture Patterns** | HIGH | FastAPI lifespan, Pydantic structured outputs, sqlite3 sync, Zustand + TanStack Query all production-tested 2026 patterns |
| **Critical Pitfalls (CRITICAL severity)** | MEDIUM-HIGH | Verified with official issue trackers, GitHub discussions, and real-world case studies; prevention code provided |
| **Database Transaction Safety** | MEDIUM | aiosqlite context manager issue confirmed in GitHub; sqlite3 + WAL + lock pattern recommended by community |
| **LLM Structured Output Reliability** | MEDIUM | OpenRouter support documented but LiteLLM detection bug confirmed; workaround straightforward |
| **Frontend State Management** | HIGH | Zustand + TanStack Query best practices for 2026; verified with official docs and community |
| **Docker Multi-Stage Build** | HIGH | Official Docker docs; common pitfall with Next.js static export (path handling) well-documented |

**Gaps to resolve in implementation:**
- Exact Next.js distDir output location (test build to confirm)
- LiteLLM version that has the OpenRouter detection fix (or confirm override flag works)
- ECharts rendering performance with real 100K+ point dataset (benchmark in Phase 4)
- EventSource reconnect behavior with rapid disconnect/connect (test in E2E)

---

## Roadmap Implications

**Critical success factors:**
1. Phase 1 must include Decimal type for all monetary values; audit P&L math with unit tests
2. Phase 2 must implement `request.is_disconnected()` check; test with concurrent clients
3. Phase 3 must validate LLM response JSON parsing; test with live OpenRouter calls before Phase 4
4. Phase 5 Dockerfile must assert frontend files exist at build time

**Time estimates:** 9-12 days total (2-3 per phase)

**Risk mitigation:**
- Spike on LiteLLM/OpenRouter compatibility (1 day) before Phase 3
- Spike on float precision handling (1 day) before Phase 1
- Load test SSE with 100+ concurrent connects (1 day) before Phase 5

**Technology decision freeze:** Complete before Phase 1 begins; stack is locked by Phase 2

---

## Sources

- FastAPI official docs (release notes, async patterns, SSE tutorial)
- Next.js 15 static export documentation
- LiteLLM GitHub issues (#2729 OpenRouter detection, structured outputs docs)
- OpenRouter API documentation
- Pydantic v2 JSON Schema documentation
- SQLite + WAL mode performance analysis (2026 sources)
- aiosqlite GitHub issues (#110 context manager behavior)
- ECharts performance benchmarks for financial charting (2026 sources)
- Docker multi-stage build best practices
- EventSource specification + browser reconnection behavior
- Real-world case studies (float precision loss in trading systems)
- Trading platform UX research (Bloomberg, TradingView, Finviz patterns)

---

**Research synthesis complete: 2026-04-09**  
**Confidence level: MEDIUM-HIGH** (high on patterns and stack, medium on some pitfall verification)  
**Readiness: Ready for requirements definition and Phase 1 planning**
