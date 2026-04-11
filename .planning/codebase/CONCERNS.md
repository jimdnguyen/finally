# Codebase Concerns

**Analysis Date:** 2026-04-09

**Status:** The market data subsystem is complete and well-tested (84% coverage, 73 tests passing). However, the project is **substantially incomplete** — only the market data layer has been implemented. All other components required by PLAN.md are missing.

---

## Incomplete Implementations

### FastAPI Server & API Endpoints

**Status:** Not started

**Missing:**
- No FastAPI application entry point (`main.py` or `app.py`) in `backend/`
- No API endpoint implementations for any of these required routes:
  - **Portfolio**: `/api/portfolio`, `/api/portfolio/trade`, `/api/portfolio/history`
  - **Watchlist**: `/api/watchlist`, `/api/watchlist/{ticker}` (GET/POST/DELETE)
  - **Chat**: `/api/chat` (message sending, LLM integration, trade execution)
  - **Health**: `/api/health`
- No database initialization code or schema SQL
- No trade execution logic (buy/sell validation, cash management, position updates)
- No portfolio valuation logic (calculating unrealized P&L, total portfolio value)
- No portfolio snapshot recording for the P&L chart
- No LLM integration code (LiteLLM, OpenRouter, structured output parsing)

**Files needed:**
- `backend/app/main.py` — FastAPI app creation, route mounting, lifespan management
- `backend/app/db/` — schema SQL, seed data, database initialization
- `backend/app/portfolio/` — trading logic, position management
- `backend/app/llm/` — LLM client, prompt construction, response parsing
- `backend/app/api/` — all endpoint implementations

**Impact:** The application cannot run. No API exists to serve the frontend, manage trades, or integrate with the LLM.

---

### Frontend Application

**Status:** Not started

**Missing:**
- `frontend/` directory is empty — no Next.js project initialized
- No React/TypeScript components for any UI element:
  - Watchlist grid with prices and sparklines
  - Main chart area for selected ticker
  - Portfolio treemap (heatmap) visualization
  - P&L line chart over time
  - Positions table
  - Trade execution UI (ticker, quantity, buy/sell buttons)
  - AI chat panel with message history and loading indicator
  - Header with portfolio value, connection status, cash balance
- No SSE client to connect to `/api/stream/prices`
- No styling (Tailwind CSS) or dark theme implementation
- No chart library integration (Lightweight Charts or Recharts)
- No TypeScript types for API responses

**Files needed:**
- `frontend/` — complete Next.js project with TypeScript
- `frontend/package.json`, `frontend/tsconfig.json`, `frontend/next.config.js`
- `frontend/components/` — all React components
- `frontend/lib/` — utilities, API client, type definitions
- `frontend/styles/` — Tailwind configuration and custom theme

**Impact:** Users see nothing. The entire user interface is missing.

---

### Database Schema & Initialization

**Status:** Not started

**Missing:**
- No SQLite schema SQL for any of the 6 required tables:
  - `users_profile` — user cash balance and state
  - `watchlist` — tracked tickers
  - `positions` — current holdings (ticker, quantity, avg_cost)
  - `trades` — append-only trade history
  - `portfolio_snapshots` — portfolio value over time (for P&L chart)
  - `chat_messages` — conversation history with actions

**Files needed:**
- `backend/db/schema.sql` — CREATE TABLE statements for all 6 tables

**Current state:**
- PLAN.md specifies lazy initialization: database is created on first request
- No code exists to perform this initialization

**Impact:** Cannot persist portfolio state, trades, or chat history. Application state is lost on restart.

---

### Docker & Deployment

**Status:** Not started

**Missing:**
- No `Dockerfile` (PLAN.md specifies a multi-stage Node → Python build)
- No `docker-compose.yml` (optional but mentioned in PLAN.md)
- No start/stop scripts in `scripts/` directory:
  - `scripts/start_mac.sh` — build and run container
  - `scripts/stop_mac.sh` — stop container
  - `scripts/start_windows.ps1` — PowerShell equivalent
  - `scripts/stop_windows.ps1` — PowerShell equivalent
- No `.env.example` template

**Files needed:**
- `Dockerfile` — multi-stage build per PLAN.md Section 11
- `docker-compose.yml` (optional convenience)
- `scripts/start_mac.sh`, `scripts/stop_mac.sh`
- `scripts/start_windows.ps1`, `scripts/stop_windows.ps1`
- `.env.example`

**Impact:** Users cannot run the application. No Docker image means no deployment path.

---

### E2E Tests

**Status:** Not started

**Missing:**
- No Playwright E2E test files in `test/`
- No `docker-compose.test.yml` for test infrastructure
- No test scenarios implemented (fresh start, watchlist CRUD, trading, chat, SSE resilience)

**Files needed:**
- `test/*.spec.ts` or `test/*.test.ts` — Playwright test files
- `test/docker-compose.test.yml` — test environment
- `test/fixtures/` — test data if needed

**Current state:**
- Only `test/test-results/` directory exists (empty results)

**Impact:** No automated verification that the full system works end-to-end.

---

## Technical Debt & Design Concerns

### Market Data — Potential Issues

**Simulator GBM Parameter Tuning** (`backend/app/market/seed_prices.py`, `backend/app/market/simulator.py`)
- Files: `backend/app/market/seed_prices.py`, `backend/app/market/simulator.py`
- Issue: Hardcoded GBM parameters (drift, volatility) per ticker and fixed correlation structure may not produce realistic or visually compelling price action
- Risk: Prices may move too slowly, too fast, or without enough drama for demo purposes
- Consideration: May need adjustment after observing live simulator output in context of the full UI

**Massive API Client Error Handling** (`backend/app/market/massive_client.py`)
- Files: `backend/app/market/massive_client.py`, lines 118–121
- Issue: Poll failures are logged but silently ignored — the loop retries on the next interval
- Risk: If an API key is invalid (401), the app silently fails to update prices; user sees stale data with no indication of error
- Mitigation: Current behavior is acceptable for a demo (graceful degradation), but should be revisited for production
- Note: Memory user's note about LiteLLM bug (`openrouter/openrouter/free` model string) — may apply here too

**PriceCache Thread Safety** (`backend/app/market/cache.py`)
- Files: `backend/app/market/cache.py`
- Issue: Cache uses a lock but only protects the dictionary itself, not the version counter
- Current behavior: Version is incremented atomically, which is sufficient for the single-threaded async event loop
- Risk: If backend ever becomes multi-threaded (unlikely with asyncio), race condition on version counter could occur
- Status: Not a current concern, but document the assumption

---

## Security Concerns

### API Key Exposure

**LLM API Key** (`OPENROUTER_API_KEY`)
- Files: Backend reads from `.env` (per PLAN.md)
- Risk: If `.env` is committed to git, API key is leaked
- Status: `.gitignore` should prevent this; verify via git check
- Mitigation: Standard practice — use `.env.example` as template

**Massive API Key** (`MASSIVE_API_KEY`)
- Same risk and mitigation as above

### Missing Input Validation

**Current status:** No validation code exists yet (no API endpoints)

**To be addressed in portfolio/API layer:**
- Trade endpoint must validate:
  - Ticker format (alphanumeric, 1-5 chars, uppercase)
  - Quantity is positive, not zero
  - Side is "buy" or "sell"
  - User has sufficient cash for buys
  - User has sufficient shares for sells
- Watchlist endpoint must validate ticker format before querying market data
- Chat endpoint must validate message length and structure

**Risk:** Without validation, malformed requests could crash the API or cause database inconsistency

---

### LLM Auto-Execution Risk

**Design:** Per PLAN.md Section 9, LLM responses automatically execute trades with no confirmation dialog

**Rationale given:** Simulated environment, zero real-world stakes, impressive demo

**Caveats for production:**
- If this design is ever extended to real money, auto-execution is extremely dangerous
- Current implementation should add guard rails:
  - Trades specified by LLM should validate against the same rules as manual trades
  - Failed trades should be reported back to the user via chat (already planned in PLAN.md)
  - Consider adding a "dry run" mode for testing LLM responses safely

**Current status:** Not yet implemented; noted for when chat layer is built

---

## Performance Risks

### SSE Streaming Scalability

**Endpoint:** `backend/app/market/stream.py`, `/api/stream/prices`

**Current design:** Server pushes all ticker prices to all connected clients every 500ms

**Scaling concern:**
- Fine for single user (intended design)
- With N concurrent users, backend sends N × (number of tickers) updates per second
- 10 tickers × 100 users = 1000 messages/sec (manageable with FastAPI/uvicorn)
- 10 tickers × 1000 users = 10,000 messages/sec (likely becomes a bottleneck)

**Mitigation:** Not needed for single-user demo, but noted for multi-user phase:
- Could optimize by only sending tickers the user is watching (filter by watchlist)
- Could batch updates in a single JSON payload per client (already done)
- WebSocket would be more efficient than SSE at scale

**Current status:** Fine for intended scope; revisit if multi-user support is added

---

### SQLite Limitations

**Concern:** PLAN.md specifies SQLite for single-user simplicity

**Scaling limits:**
- SQLite is single-writer (will serialize concurrent writes)
- For single user with one session, this is fine
- If multi-user is added, concurrent trades across users will serialize, causing latency
- Portfolio snapshot recording every 30 seconds could be slow with many trade operations

**Mitigation:** Not applicable to current single-user design. Document as a migration point if multi-user is needed.

**Current status:** Acceptable for single-user demo

---

## Missing Features (vs. PLAN.md)

### From Section 8 (Database) — All schema tables
- `users_profile` — not created
- `watchlist` — not created
- `positions` — not created
- `trades` — not created
- `portfolio_snapshots` — not created
- `chat_messages` — not created

### From Section 8 — Lazy initialization logic
- No code to check if database exists
- No code to create schema if missing
- No code to seed default data

### From Section 8 — Seed data
- Default user profile (id="default", cash_balance=10000.0)
- 10 default watchlist tickers (AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX)
- None of this is created by backend

### From Section 9 (LLM Integration) — All components
- No LLM client setup
- No prompt construction with portfolio context
- No structured output parsing (JSON schema validation)
- No auto-execution logic for trades in chat flow
- No trade validation within LLM context (e.g., reject if insufficient cash)
- No watchlist modifications from chat
- No chat message storage in `chat_messages` table

### From Section 10 (Frontend) — All UI components
- Watchlist panel with prices and sparklines
- Main chart area
- Portfolio treemap (heatmap)
- P&L chart
- Positions table
- Trade bar UI
- Chat panel
- Header with status indicator and cash balance

### From Section 12 (Testing) — All E2E tests
- No Playwright tests implemented
- No docker-compose.test.yml for test infrastructure
- No test scenarios

---

## Error Handling Gaps

### Backend API Layer (not yet built)

**Anticipated gaps:**
- No 404 handlers for nonexistent tickers
- No 400 handlers for malformed requests (invalid trade data, bad ticker format)
- No 409 handlers for constraint violations (e.g., selling more shares than owned)
- No 500 error logging strategy
- No rate limiting or abuse protection

**To be addressed when API routes are implemented**

---

### Frontend Error Handling (not yet built)

**Anticipated gaps:**
- No error boundary for component crashes
- No network error handling (failed API calls, SSE disconnection)
- No user-facing error messages
- No retry logic for failed requests
- No timeout handling for slow API responses

**To be addressed when frontend is built**

---

### LLM Response Parsing (not yet built)

**Anticipated concern:**
- If LLM returns malformed JSON, backend should gracefully reject and inform user
- If trades fail validation, the response should include error messages so LLM can inform user
- No timeout on LLM request (could hang indefinitely)

**To be addressed when chat layer is built**

---

## Testing Gaps

### Backend Unit Tests

**Current state:**
- Market data module: 73 tests, 84% coverage ✓ (complete)
- Portfolio: 0 tests (not implemented)
- LLM: 0 tests (not implemented)
- API routes: 0 tests (not implemented)
- Database: 0 tests (schema not created)

**Required coverage:**
- All endpoints (portfolio, watchlist, chat, health)
- Trade execution edge cases (insufficient cash, insufficient shares, zero quantity)
- Portfolio calculation (unrealized P&L, total value)
- LLM structured output parsing
- Database initialization and schema validation

---

### Frontend Unit Tests

**Current state:** 0 tests (frontend not started)

**Required coverage (per PLAN.md Section 12):**
- Component rendering with mock data
- Price flash animation triggers on price changes
- Watchlist CRUD operations
- Portfolio display calculations
- Chat message rendering and loading state

---

### E2E Tests

**Current state:** 0 tests (not started)

**Required scenarios (per PLAN.md Section 12):**
- Fresh start: default watchlist appears, $10k balance shown, prices streaming
- Add and remove a ticker from watchlist
- Buy shares: cash decreases, position appears, portfolio updates
- Sell shares: cash increases, position updates or disappears
- Portfolio visualization: heatmap renders with correct colors, P&L chart has data points
- AI chat (mocked): send a message, receive a response, trade execution appears inline
- SSE resilience: disconnect and verify reconnection

---

## Production Readiness Assessment

### Market Data Layer
**Status:** Production-ready for single-user demo
- Complete implementation
- 84% test coverage
- Handles both simulator and real market data via environment variable
- Graceful error handling for API failures
- Appropriate logging

### API Layer
**Status:** Not started — blocking all downstream work

### Frontend
**Status:** Not started

### Database
**Status:** Not started — cannot persist any state

### Docker & Deployment
**Status:** Not started — no deployment path

### Overall
**Status:** Prototype stage. Only the market data component is complete; everything else is missing. The application cannot run or be deployed without completing all other components.

---

## Critical Path for Completion

Based on dependencies, the next priorities are:

1. **Database schema & initialization** (`backend/db/`) — blocks portfolio and chat
2. **Portfolio API & trading logic** (`backend/app/portfolio/`) — enables core functionality
3. **FastAPI entry point** (`backend/app/main.py`) — glues market data to new components
4. **Frontend skeleton** (`frontend/`) — minimal Next.js setup
5. **Chat/LLM integration** (`backend/app/llm/`, `POST /api/chat`) — advanced feature
6. **Docker image & scripts** — deployment
7. **E2E tests** — validation

All items must be completed for the application to be functional and demo-ready.

---

*Concerns audit: 2026-04-09*
