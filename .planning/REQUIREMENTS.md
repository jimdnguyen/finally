# Requirements: FinAlly

**Defined:** 2026-04-09
**Core Value:** A Bloomberg-terminal-style UI with streaming live prices and an AI copilot that actually executes trades — showcasing orchestrated AI agents building a real full-stack product end-to-end.

---

## v1 Requirements

### Market Data *(already built — Validated)*

- ✓ **MKTD-01**: SSE endpoint `/api/stream/prices` pushes live price updates to all connected clients at ~500ms cadence
- ✓ **MKTD-02**: GBM simulator generates realistic correlated prices with drift, volatility, and occasional random events
- ✓ **MKTD-03**: Massive API (Polygon.io) client conforms to same `MarketDataSource` interface for optional real data
- ✓ **MKTD-04**: Thread-safe in-memory `PriceCache` holds latest price, previous price, and timestamp per ticker
- ✓ **MKTD-05**: Market data source selected at startup via `MASSIVE_API_KEY` environment variable

### Database & Persistence

- [ ] **DATA-01**: SQLite database lazily initializes on first startup — creates schema and seeds default data if file missing
- [ ] **DATA-02**: Schema includes: `users_profile`, `watchlist`, `positions`, `trades`, `portfolio_snapshots`, `chat_messages` (all with `user_id` column defaulting to `"default"`)
- [ ] **DATA-03**: Default seed data: one user profile (cash_balance=10000.0) and 10 watchlist tickers (AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX)
- [ ] **DATA-04**: SQLite WAL mode enabled; all monetary values stored and calculated using Decimal precision
- [ ] **DATA-05**: Portfolio snapshot background task records total portfolio value every 30 seconds and immediately after each trade

### Portfolio API

- [ ] **PORT-01**: `GET /api/portfolio` returns current positions, cash balance, total portfolio value, and unrealized P&L per position
- [ ] **PORT-02**: `POST /api/portfolio/trade` executes market buy or sell: validates sufficient cash (buy) or sufficient shares (sell), updates position atomically, appends to trade log
- [ ] **PORT-03**: `GET /api/portfolio/history` returns portfolio value snapshots over time for P&L chart
- [ ] **PORT-04**: Trade execution uses atomic SQLite transaction (`BEGIN IMMEDIATE`) — no partial state on failure

### Watchlist API

- [ ] **WTCH-01**: `GET /api/watchlist` returns all watched tickers with latest prices from price cache
- [ ] **WTCH-02**: `POST /api/watchlist` adds a ticker (validates format, rejects duplicates)
- [ ] **WTCH-03**: `DELETE /api/watchlist/{ticker}` removes a ticker from the watchlist

### Chat & LLM Integration

- [ ] **CHAT-01**: `POST /api/chat` accepts user message, loads portfolio context + conversation history, calls LLM, returns structured response
- [ ] **CHAT-02**: LLM returns structured JSON: `{ message, trades[], watchlist_changes[] }` validated with Pydantic schema
- [ ] **CHAT-03**: Trades and watchlist changes from LLM response are auto-executed (same validation as manual trades); failures reported in response
- [ ] **CHAT-04**: `LLM_MOCK=true` returns deterministic mock response without calling OpenRouter (enables fast E2E tests)
- [ ] **CHAT-05**: Conversation history persisted in `chat_messages` table with role, content, and executed actions (JSON)
- [ ] **CHAT-06**: LiteLLM configured to force structured output for OpenRouter (override detection bug)

### System

- [ ] **SYS-01**: `GET /api/health` returns 200 OK with status (for Docker healthcheck)

### Frontend — Layout & Visual Design

- [ ] **UI-01**: Dark terminal aesthetic: background ~`#0d1117`, muted gray borders, accent yellow `#ecad0a`, blue `#209dd7`, purple `#753991`; Tailwind CSS dark theme
- [ ] **UI-02**: Single-page layout with all panels visible simultaneously (desktop-first, wide screen optimized)
- [ ] **UI-03**: Header shows live-updating total portfolio value, cash balance, and connection status indicator dot (green/yellow/red)

### Frontend — Watchlist Panel

- [ ] **UI-04**: Watchlist panel displays all watched tickers: symbol, current price, daily change %, and sparkline mini-chart
- [ ] **UI-05**: Price flash animation: brief green/red background highlight on price change, fades over ~500ms via CSS transition
- [ ] **UI-06**: Sparklines accumulate price history from SSE stream since page load (fill in progressively — no historical data needed)
- [ ] **UI-07**: Clicking a ticker in the watchlist selects it and displays it in the main chart area

### Frontend — Charts

- [ ] **UI-08**: Main chart area shows price-over-time line chart for the selected ticker
- [ ] **UI-09**: Portfolio treemap/heatmap: each rectangle is a position, sized by portfolio weight, colored by P&L (green=profit, red=loss)
- [ ] **UI-10**: P&L line chart shows total portfolio value over time using data from `GET /api/portfolio/history`

### Frontend — Trading

- [ ] **UI-11**: Positions table displays all holdings: ticker, quantity, average cost, current price, unrealized P&L, % change
- [ ] **UI-12**: Trade bar: ticker input, quantity input, Buy button, Sell button — market orders, instant fill, no confirmation dialog

### Frontend — AI Chat

- [ ] **UI-13**: AI chat panel: message input, scrolling conversation history, loading indicator while awaiting LLM response
- [ ] **UI-14**: Trade executions and watchlist changes from AI appear inline in chat as confirmation badges/receipts

### Frontend — Data Layer

- [ ] **UI-15**: SSE `EventSource` client connects to `/api/stream/prices` with automatic browser reconnection; connection status reflected in header dot
- [ ] **UI-16**: All API calls target same-origin `/api/*` — no CORS configuration required
- [ ] **UI-17**: Zustand store manages client-side price state (updated from SSE); TanStack Query handles portfolio/watchlist/chat API state

### Infrastructure & Deployment

- [ ] **INFRA-01**: Multi-stage Dockerfile: Stage 1 builds Next.js static export (Node 20), Stage 2 runs FastAPI (Python 3.12 + uv)
- [ ] **INFRA-02**: FastAPI serves Next.js static export files alongside all `/api/*` routes on port 8000
- [ ] **INFRA-03**: SQLite database persists via Docker named volume mounted at `/app/db`
- [ ] **INFRA-04**: `scripts/start_mac.sh` and `scripts/stop_mac.sh` wrap Docker build + run with volume, port, and env-file
- [ ] **INFRA-05**: `scripts/start_windows.ps1` and `scripts/stop_windows.ps1` — PowerShell equivalents

### Testing

- [ ] **TEST-01**: Backend pytest: trade execution logic (buy/sell validation, atomic update, edge cases — insufficient cash, oversell, sell at loss)
- [ ] **TEST-02**: Backend pytest: LLM structured output parsing — valid schema, malformed response handling, trade validation within chat flow
- [ ] **TEST-03**: E2E Playwright tests (in `test/` with `docker-compose.test.yml`): fresh start shows default watchlist + $10k, buy shares, sell shares, AI chat with mock LLM, SSE reconnection

---

## v2 Requirements

### Enhanced Charts
- **VIZ-01**: Candlestick chart option for main chart area
- **VIZ-02**: Volume bars beneath price chart
- **VIZ-03**: Basic technical indicators (SMA, RSI)

### Trade Management
- **TRADE-01**: Trade history view (full log of all executed trades)
- **TRADE-02**: Export portfolio/trade history as CSV

### UX Enhancements
- **UX-01**: Watchlist custom ordering (drag to reorder)
- **UX-02**: Ticker search with autocomplete
- **UX-03**: Keyboard shortcuts for common actions

### Notifications
- **NOTF-01**: In-app toast notifications for completed trades
- **NOTF-02**: AI-suggested trades surfaced proactively (not just on user message)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| User authentication / multi-user | Single-user demo; schema has `user_id` for future migration |
| Limit orders, stop losses, order book | Market orders only — eliminates order book complexity |
| Real-time WebSockets | SSE one-way push is sufficient; no bidirectional need |
| Postgres / external database | SQLite is self-contained and zero-config for single-user |
| Cloud deployment (Terraform, App Runner) | Docker single-container is the delivery target |
| Mobile-optimized UI | Desktop-first; terminal aesthetic requires wide screens |
| Options, futures, crypto | Out of scope for v1 trading simulator |
| Real money / brokerage integration | Simulated portfolio only |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MKTD-01 | Existing | Complete |
| MKTD-02 | Existing | Complete |
| MKTD-03 | Existing | Complete |
| MKTD-04 | Existing | Complete |
| MKTD-05 | Existing | Complete |
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Pending |
| DATA-04 | Phase 1 | Pending |
| DATA-05 | Phase 2 | Pending |
| PORT-01 | Phase 1 | Pending |
| PORT-02 | Phase 2 | Pending |
| PORT-03 | Phase 1 | Pending |
| PORT-04 | Phase 1 | Pending |
| WTCH-01 | Phase 1 | Pending |
| WTCH-02 | Phase 4 | Pending |
| WTCH-03 | Phase 4 | Pending |
| CHAT-01 | Phase 3 | Pending |
| CHAT-02 | Phase 3 | Pending |
| CHAT-03 | Phase 3 | Pending |
| CHAT-04 | Phase 3 | Pending |
| CHAT-05 | Phase 3 | Pending |
| CHAT-06 | Phase 3 | Pending |
| SYS-01 | Phase 1 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |
| UI-04 | Phase 4 | Pending |
| UI-05 | Phase 4 | Pending |
| UI-06 | Phase 4 | Pending |
| UI-07 | Phase 4 | Pending |
| UI-08 | Phase 4 | Pending |
| UI-09 | Phase 4 | Pending |
| UI-10 | Phase 4 | Pending |
| UI-11 | Phase 4 | Pending |
| UI-12 | Phase 4 | Pending |
| UI-13 | Phase 4 | Pending |
| UI-14 | Phase 4 | Pending |
| UI-15 | Phase 4 | Pending |
| UI-16 | Phase 4 | Pending |
| UI-17 | Phase 4 | Pending |
| INFRA-01 | Phase 5 | Pending |
| INFRA-02 | Phase 5 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 5 | Pending |
| INFRA-05 | Phase 5 | Pending |
| TEST-01 | Phase 5 | Pending |
| TEST-02 | Phase 5 | Pending |
| TEST-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 48 total (5 existing/validated + 43 pending)
- Mapped to phases: 43/43 pending requirements mapped
- Unmapped: 0

---

*Requirements defined: 2026-04-09*
*Last updated: 2026-04-09 (roadmap created)*
