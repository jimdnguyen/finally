---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
---

# finally - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for FinAlly, decomposing the requirements from the PRD, Architecture, and UX Design Specification into implementable stories.

---

## Requirements Inventory

### Functional Requirements

FR1: Users can view a live-updating list of watched tickers with current prices
FR2: Users can see visual indicators (color, animation) when a price changes up or down
FR3: Users can see a mini price chart (sparkline) for each watched ticker, built from live data since page load
FR4: Users can see a connection status indicator showing whether the live data stream is active
FR5: The system automatically reconnects to the live data stream after a connection loss
FR6: Users can view their current watchlist of tickers
FR7: Users can add a ticker to their watchlist
FR8: Users can remove a ticker from their watchlist
FR9: The system seeds a default watchlist of 10 tickers on first launch
FR10: Users can select a ticker to view a larger detailed price chart
FR11: The detail chart displays price history accumulated since page load
FR12: Users can view their current cash balance
FR13: Users can view all current positions with quantity, average cost, current price, unrealized P&L, and % change
FR14: Users can execute a market buy order for a specified ticker and quantity
FR15: Users can execute a market sell order for a specified ticker and quantity
FR16: The system rejects trades that exceed available cash (buy) or owned shares (sell) and surfaces an error
FR17: Users can view a heatmap visualization of their portfolio, sized by position weight and colored by P&L
FR18: Users can view a chart of their total portfolio value over time
FR19: Users can send natural language messages to an AI assistant
FR20: The AI assistant responds with portfolio analysis, market observations, and trade suggestions
FR21: The AI assistant can execute trades on the user's behalf via natural language instruction
FR22: The AI assistant can add or remove tickers from the watchlist via natural language instruction
FR23: Trades and watchlist changes executed by the AI are confirmed in the chat response
FR24: The AI assistant has access to the user's current portfolio context (cash, positions, watchlist, live prices) when responding
FR25: The system displays a loading indicator while waiting for an AI response
FR26: The system displays an error message and allows retry when an AI response fails or times out
FR27: AI chat failures do not affect the trading terminal, price stream, or other UI components
FR28: When a manual trade executes successfully, the portfolio panels (positions table, heatmap, header value) update immediately — the update itself is the confirmation; no toast
FR29: When a trade validation error occurs (insufficient cash/shares), an inline error message appears below the trade bar inputs in red — persistent until next submit; no toast
FR30: When a ticker is added to the watchlist, the row appears immediately with live price; when removed, the row disappears; inline error below add-ticker input on failure; no toast
FR31: The system records portfolio value snapshots over time for chart display
FR32: Portfolio state (positions, cash, watchlist) persists across application restarts
FR33: A fresh database initializes with default seed data ($10,000 cash, 10 default tickers)
FR34: The application is accessible via a single Docker command with no additional setup beyond an API key
FR35: The system exposes a health check endpoint for operational monitoring
FR36: The system supports a mock LLM mode for deterministic testing without live API calls
FR37: Start and stop scripts are idempotent — safe to run multiple times without breaking state

---

### Non-Functional Requirements

NFR1: Price update events received via SSE must be rendered in the UI within 100ms of receipt
NFR2: Manual trade execution (button click → positions table update) must complete within 1 second
NFR3: Initial page load on localhost must complete within 3 seconds
NFR4: The application must not drop frames or stutter during continuous 500ms SSE price updates
NFR5: Portfolio snapshot recording (background task) must not block or delay API responses
NFR6: The SSE connection must automatically recover from network interruptions without user action
NFR7: LLM API failures (timeout, error, malformed response) must be isolated to the chat panel
NFR8: The application must start cleanly from a fresh Docker volume with no manual database setup
NFR9: The application must preserve all portfolio state across container restarts via the mounted SQLite volume
NFR10: The OpenRouter API key must only be read from environment variables — never hardcoded or logged
NFR11: The API must not expose any endpoint that can delete or corrupt the database without explicit user action
NFR12: LLM calls must use `openrouter/openrouter/free` via LiteLLM — must not be changed to paid model without explicit configuration
NFR13: When `LLM_MOCK=true`, the system must return deterministic responses — no live API calls
NFR14: If `MASSIVE_API_KEY` is absent or empty, the system must fall back to the built-in simulator without error

---

### Additional Requirements (Architecture)

- ARCH-1: Frontend must be initialized with `npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack` — this is the first frontend implementation step
- ARCH-2: Add backend dependencies before any implementation: `uv add aiosqlite litellm` (not yet in pyproject.toml)
- ARCH-3: Add frontend dependencies: `npm install lightweight-charts zustand`
- ARCH-4: DB init module (`backend/app/db/`) must lazily initialize on startup: check for tables, create schema + seed if missing; uses `aiosqlite` + raw SQL, no ORM
- ARCH-5: Zustand stores required: `usePriceStore` (prices + sparkline buffers, 200-point cap), `usePortfolioStore` (positions, cash), `useWatchlistStore` (tickers); selectors per-ticker to prevent re-render storms
- ARCH-6: FastAPI `lifespan` async context manager manages all background tasks (market data source + portfolio snapshot task); never use per-request `BackgroundTasks` for long-running loops
- ARCH-7: FastAPI serves static Next.js export (`frontend/out/`) via `StaticFiles(html=True)` for SPA fallback; API routes registered before static mount so `/api/*` takes precedence
- ARCH-8: LLM mock mode: when `LLM_MOCK=true`, return hardcoded `ChatResponse` fixture (includes a sample buy trade for E2E coverage); zero LiteLLM calls
- ARCH-9: All API error responses use envelope: `{"error": "...", "code": "..."}` with HTTP status codes; error codes: `INSUFFICIENT_CASH`, `INSUFFICIENT_SHARES`, `TICKER_NOT_FOUND`, `TICKER_ALREADY_IN_WATCHLIST`, `LLM_ERROR`, `INVALID_QUANTITY`, `INVALID_SIDE`
- ARCH-10: All frontend API calls routed through `src/lib/api.ts` — no inline `fetch()` in components; functions return typed responses or throw `ApiError` with `code` field
- ARCH-11: After any trade execution, always refetch portfolio from `/api/portfolio`; after any watchlist change, refetch from `/api/watchlist`; never optimistically update
- ARCH-12: All JSON field names use `snake_case` throughout (backend and frontend); no camelCase in API responses
- ARCH-13: All aiosqlite queries use parameterized queries — never string-formatted SQL
- ARCH-14: All price reads go through `PriceCache.get(ticker)` — never import or access simulator/Massive client directly
- ARCH-15: Sparkline buffers capped at 200 data points per ticker in `priceStore`
- ARCH-16: Portfolio snapshots recorded every 30 seconds (background task) AND immediately after each trade execution (inline in trade handler)
- ARCH-17: Multi-stage Dockerfile: Node 20 slim (frontend build → `out/`) → Python 3.12 slim (runtime); copies `out/` into image for static serving
- ARCH-18: Makefile with targets: `start`, `stop`, `build`, `logs`, `test`, `clean` (clean prompts confirmation before volume removal)
- ARCH-19: `.env.example` committed to repo with `OPENROUTER_API_KEY`, `MASSIVE_API_KEY`, `LLM_MOCK` variables
- ARCH-20: Playwright E2E infrastructure in `test/docker-compose.test.yml`; E2E specs in `test/specs/`; run with `LLM_MOCK=true`
- ARCH-21: Backend domain structure: each domain (`portfolio/`, `watchlist/`, `chat/`, `health/`) contains `router.py`, `service.py`, `models.py`, `db.py`
- ARCH-22: `openrouter/openrouter/free` model string hardcoded in `chat/service.py` — never derived from config or environment
- ARCH-23: `ChatPanel` must have its own React error boundary — LLM failures cannot propagate to sibling components

---

### UX Design Requirements

UX-DR1: Configure `tailwind.config.ts` with full custom design token palette: `background: #0d1117`, `surface: #161b22`, `border: #30363d`, `text-primary: #e6edf3`, `text-muted: #8b949e`, `accent-yellow: #ecad0a`, `blue-primary: #209dd7`, `purple-action: #753991`, `green-up: #3fb950`, `red-down: #f85149`
UX-DR2: Integrate JetBrains Mono for all financial values, prices, and ticker symbols; Inter/system-ui for all UI labels and body text
UX-DR3: CSS Grid three-column layout: 180px fixed watchlist | `flex: 1` center column (MainChart + TabStrip + tabbed panels) | 300px fixed AI chat panel; fixed 48px header
UX-DR4: `WatchlistRow` component: ticker symbol | 52×20px SparklineChart | stacked price + % change; states: default, active (blue left border), flash-green, flash-red; click updates selectedTicker
UX-DR5: `PriceFlash` animation: `.flash-green` / `.flash-red` CSS classes applied for 500ms on SSE price change via React `useEffect` comparing prev vs current price, then removed
UX-DR6: `MainChart` using Lightweight Charts `createChart()` with ResizeObserver, full dark theme config, instant ticker-switch re-render from in-memory price cache; no loading state on ticker switch
UX-DR7: `SparklineChart` using Lightweight Charts minimal mode (no axes, no grid, no crosshair); data accumulated from SSE in priceStore as `{time, value}` arrays per ticker
UX-DR8: `PortfolioHeatmap` as custom div-based treemap: `flex-basis` proportional to position weight, background interpolated between `red-down` and `green-up` by P&L%; `aria-label="AAPL +8.5%"` per cell; empty state shows muted text message
UX-DR9: `ChatLog` with terminal log row variants: `.log-user` (yellow `> ` prefix), `.log-ai-label` (18px purple avatar dot + "AI" text + timestamp), `.log-ai` (blue left border, indented text), `.log-exec-ok` (green EXEC confirmation), `.log-exec-fail` (red EXEC failure); animated `...` loading cursor
UX-DR10: `TradeBar` with flat border-bottom inputs (no box border, no border-radius, transparent background), inline error text below inputs (not toast), ticker pre-fills from WatchlistRow click via `selectedTicker`, buttons disabled during submission
UX-DR11: `TabStrip` below MainChart: Heatmap · Positions · P&L History; 30px fixed height; active tab has blue bottom border; instant panel swap (no transition animation)
UX-DR12: `StatusDot` in header: green + subtle glow (connected), yellow + pulsing animation (reconnecting), red no animation (disconnected); driven by EventSource onopen/onerror events
UX-DR13: `PositionsTable` columns: Ticker · Qty · Avg Cost · Price · Unrealized P&L · %; JetBrains Mono for all numeric cells; P&L and % cells update green/red with explicit `+`/`−` prefix
UX-DR14: `Header` displays: portfolio total value (live from portfolioStore), cash balance, StatusDot, brand logo in accent-yellow; 48px fixed height
UX-DR15: All form inputs use flat border-bottom style only: `border: none; border-bottom: 1px solid var(--border); background: transparent`; focus state changes border-bottom color to blue-primary; no border-radius anywhere on inputs
UX-DR16: No toast notifications in the application; feedback patterns: manual trade success = portfolio panels update (self-evident); manual trade error = inline red text below trade bar; AI trade result = permanent EXEC log lines in chat; watchlist errors = inline below add-ticker input
UX-DR17: Empty states: muted text only (no illustrations, no icons); positions + heatmap: "No positions — buy something to get started"; P&L History: "No history yet — portfolio snapshots appear after your first trade"; chat: AI greeting message pre-loaded on page load
UX-DR18: AI chat loading: animated `...` cursor on `.log-ai-label` row is the ONLY loading indicator in the entire application; price placeholder `—` for tickers not yet received on first load (no skeleton screens); all other interactions feel instant
UX-DR19: Button hierarchy: primary (Buy/Sell/Send) = purple background `#753991`, uppercase text, zero border-radius; secondary (tabs, add ticker) = border/underline only; destructive (remove ticker) = red text revealed on row hover only; disabled = 40% opacity + `cursor: not-allowed`
UX-DR20: P&L sign rule absolute: positive P&L always shows explicit `+` prefix; negative always shows `−` (Unicode minus U+2212, not hyphen); color alone never conveys P&L direction
UX-DR21: Color usage rules absolute: green (`#3fb950`) — uptick, positive P&L, EXEC OK, connected dot only; red (`#f85149`) — downtick, negative P&L, EXEC fail only; yellow (`#ecad0a`) — user chat, brand logo, interactive highlights only; blue (`#209dd7`) — active selection, AI label, tab indicator only; purple (`#753991`) — action buttons, AI avatar dot only
UX-DR22: Chat input: `>` prefix display, flat underline field (JetBrains Mono), rectangular purple "Send" button; Enter submits; placeholder: `"buy 10 AAPL · analyze portfolio"`
UX-DR23: Watchlist management UI: `+` add-ticker input at bottom of watchlist panel, Enter submits, inline error below for invalid tickers; hover on watchlist row reveals X remove button (not permanently visible)

---

### FR Coverage Map

FR1: Epic 1 — Live price updates in watchlist
FR2: Epic 1 — Flash animations on price change
FR3: Epic 1 — Sparkline mini-charts per ticker
FR4: Epic 1 — Connection status indicator
FR5: Epic 1 — SSE auto-reconnect
FR6: Epic 1 — Watchlist view (default seed)
FR7: Epic 2 — Add ticker to watchlist
FR8: Epic 2 — Remove ticker from watchlist
FR9: Epic 1 — Default 10-ticker seed on first launch
FR10: Epic 1 — Ticker selection → main chart
FR11: Epic 1 — Main chart from accumulated SSE data
FR12: Epic 2 — Cash balance display
FR13: Epic 2 — Positions table (qty, avg cost, price, P&L, %)
FR14: Epic 2 — Market buy order execution
FR15: Epic 2 — Market sell order execution
FR16: Epic 2 — Trade validation (insufficient cash/shares) with inline error
FR17: Epic 2 — Portfolio heatmap (treemap by weight, colored by P&L)
FR18: Epic 2 — P&L history chart (portfolio value over time)
FR19: Epic 3 — User sends natural language messages to AI
FR20: Epic 3 — AI responds with portfolio analysis and trade suggestions
FR21: Epic 3 — AI executes trades on user's behalf
FR22: Epic 3 — AI manages watchlist via natural language
FR23: Epic 3 — AI confirms executed trades/changes in chat (EXEC log lines)
FR24: Epic 3 — AI has full portfolio context (cash, positions, watchlist, live prices)
FR25: Epic 3 — Loading indicator while waiting for AI response
FR26: Epic 3 — AI error message with retry capability
FR27: Epic 3 — AI failures isolated to chat panel (error boundary)
FR28: Epic 2 — Manual trade success: portfolio panels update immediately (no toast)
FR29: Epic 2 — Trade validation error: inline red text below trade bar (no toast)
FR30: Epic 2 — Watchlist add/remove: row appears/disappears; inline error on failure (no toast)
FR31: Epic 2 — Portfolio value snapshots recorded over time
FR32: Epic 2 — Portfolio state persists across restarts (SQLite volume)
FR33: Epic 2 — Fresh DB initializes with $10k cash + 10 default tickers
FR34: Epic 4 — Single Docker command launch
FR35: Epic 4 — Health check endpoint
FR36: Epic 4 — LLM mock mode for deterministic testing
FR37: Epic 4 — Idempotent start/stop scripts

---

## Epic List

### Epic 1: Live Market Terminal
Users can open the app and see a Bloomberg-style trading terminal with live streaming prices, flash animations, sparklines per ticker, a selectable main chart, and a connection status indicator. The screen feels alive immediately on page load.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR9, FR10, FR11

### Epic 2: Portfolio Management & Trading
Users can trade a simulated $10,000 portfolio — execute buy/sell market orders, view current positions with live P&L, manage their watchlist manually, and track portfolio value over time via the heatmap and P&L chart. All feedback is inline and immediate.
**FRs covered:** FR7, FR8, FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR28, FR29, FR30, FR31, FR32, FR33

### Epic 3: AI Trading Assistant
Users can chat with an AI assistant that understands their full portfolio context, analyzes positions, and executes trades and watchlist changes on their behalf via natural language. All AI actions are confirmed inline in the chat log with permanent EXEC attribution lines.
**FRs covered:** FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27

### Epic 4: Deployment & Quality
The app runs from a single Docker command with no setup beyond providing an API key, exposes a health check endpoint, supports deterministic LLM mock mode for testing, and includes full Playwright E2E test coverage.
**FRs covered:** FR34, FR35, FR36, FR37

---

---

## Epic 1: Live Market Terminal

### Story 1.1: Backend Foundation & Watchlist API

**As a** developer setting up the project for the first time,
**I want** the backend to initialize the database and expose a watchlist API,
**so that** all downstream features have a reliable data foundation.

**Acceptance Criteria:**

1. **Given** the project has no `aiosqlite` or `litellm` in `pyproject.toml`, **when** `uv add aiosqlite litellm` is run, **then** both packages are added and `uv.lock` is updated.
2. **Given** the SQLite file does not exist at `db/finally.db`, **when** the FastAPI app starts via `lifespan`, **then** all 6 tables are created (users_profile, watchlist, positions, trades, portfolio_snapshots, chat_messages) and seeded with one user (`cash_balance=10000.0`) and 10 default watchlist tickers (AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX).
3. **Given** the database already exists with data, **when** the app restarts, **then** no tables are re-created and no seed data is duplicated.
4. **Given** the app is running, **when** `GET /api/watchlist` is called, **then** it returns a JSON array of objects with `ticker` and `price` fields (price may be `null` if market data hasn't arrived yet).
5. **Given** the app starts, **when** the `lifespan` context manager runs, **then** the market data background task (simulator or Massive) starts and begins populating the price cache.

---

### Story 1.2: Frontend Shell & Design System

**As a** developer building the frontend,
**I want** the Next.js project initialized with the correct config and design tokens,
**so that** all UI components share a consistent dark terminal aesthetic.

**Acceptance Criteria:**

1. **Given** the `frontend/` directory does not exist, **when** `npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack` is run, **then** a valid Next.js project is created with `next.config.ts` containing `output: 'export'` and `distDir: 'out'`.
2. **Given** the frontend is initialized, **when** `tailwind.config.ts` is updated, **then** it contains all 10 custom design tokens as Tailwind color classes: `background: #0d1117`, `surface: #161b22`, `border: #30363d`, `text-primary: #e6edf3`, `text-muted: #8b949e`, `accent-yellow: #ecad0a`, `blue-primary: #209dd7`, `purple-action: #753991`, `green-up: #3fb950`, `red-down: #f85149`.
3. **Given** the design system is configured, **when** the app root layout renders, **then** the page uses CSS Grid with three columns (180px watchlist | `flex: 1` center | 300px chat) and a 48px fixed header, verified visually at 1440px viewport.
4. **Given** `npm run build` completes (producing `frontend/out/`), **when** FastAPI starts with `StaticFiles(html=True)` mounted at `/`, **then** `GET /` returns the Next.js index page and `GET /api/health` returns `{"status": "ok"}` (API routes take precedence).
5. **Given** the layout renders, **when** inspecting font rendering, **then** JetBrains Mono is applied to all price/ticker/numeric elements and Inter (or system-ui) is applied to all labels and body text.

---

### Story 1.3: Live Price Stream & Zustand Stores

**As a** user opening the app,
**I want** prices to stream live from the server and update the UI in real time,
**so that** the terminal feels alive immediately on page load.

**Acceptance Criteria:**

1. **Given** the app loads in the browser, **when** `EventSource` connects to `/api/stream/prices`, **then** the `StatusDot` in the header turns green (solid, subtle glow) within 1 second.
2. **Given** the SSE connection is active, **when** a price event arrives, **then** `priceStore` is updated and the corresponding UI element re-renders within 100ms of receipt (NFR1).
3. **Given** the app loads, **when** `useWatchlistStore` initializes, **then** it fetches `GET /api/watchlist` and populates the store with the 10 default tickers.
4. **Given** the SSE connection drops, **when** `EventSource.onerror` fires, **then** the `StatusDot` turns yellow with a pulsing animation and `EventSource` retries automatically (no user action required).
5. **Given** the SSE connection has been retrying, **when** the connection is restored, **then** the `StatusDot` returns to green and prices resume updating.
6. **Given** repeated reconnection failures, **when** the connection remains down, **then** the `StatusDot` turns red (no animation) and the watchlist shows last-known prices (no blanking or error state).

---

### Story 1.4: Watchlist Panel with Price Flash & Sparklines

**As a** user watching the market,
**I want** to see live prices flash green/red and sparkline charts beside each ticker,
**so that** I can quickly spot price movement at a glance.

**Acceptance Criteria:**

1. **Given** the SSE stream is active, **when** the watchlist panel renders, **then** all 10 default tickers are visible, each showing: ticker symbol, a 52×20px sparkline, current price, and % change (or `—` placeholder before first price arrives).
2. **Given** a price update arrives for a ticker, **when** the new price differs from the previous price, **then** the row background flashes `.flash-green` (uptick) or `.flash-red` (downtick) for exactly 500ms via CSS transition, then returns to default — implemented in React `useEffect` comparing prev vs current price.
3. **Given** prices are streaming, **when** each new price arrives, **then** it is appended to that ticker's sparkline buffer in `priceStore` as `{time, value}`, the buffer is capped at 200 points, and the `SparklineChart` re-renders using Lightweight Charts in minimal mode (no axes, no grid, no crosshair).
4. **Given** a price change occurs, **when** the % change is positive, **then** it displays with a `+` prefix in `green-up` color; when negative, it displays with a `−` (U+2212) prefix in `red-down` color.
5. **Given** prices are updating rapidly, **when** the watchlist renders, **then** all price and % values use JetBrains Mono font to prevent layout shift from variable-width digits.

---

### Story 1.5: Main Chart & Ticker Selection

**As a** user who wants to analyze a specific ticker,
**I want** to click a ticker in the watchlist and see a detailed price chart,
**so that** I can track price action for my chosen stock.

**Acceptance Criteria:**

1. **Given** the app loads, **when** the main chart area renders for the first time, **then** AAPL is selected by default and its chart displays with a blue left border on the AAPL watchlist row.
2. **Given** a ticker is selected, **when** the user clicks a different ticker in the watchlist, **then** the main chart instantly switches to that ticker's price history (from `priceStore`), the blue left border moves to the new row, and there is no loading state or transition delay.
3. **Given** a ticker is selected in the main chart, **when** new price events arrive for that ticker, **then** the chart updates in real time as data accumulates.
4. **Given** the browser window is resized, **when** the layout reflows, **then** `ResizeObserver` triggers a chart resize and the chart fills its container without overflow or clipping.
5. **Given** the chart renders, **when** inspecting its visual config, **then** it uses the full dark theme: background `#0d1117`, grid lines `#30363d`, axis text `#8b949e`, price line `#209dd7`, using Lightweight Charts `createChart()` with explicit theme options.

---

## Epic 2: Portfolio Management & Trading

### Story 2.1: Portfolio API & Trade Execution

**As a** user who wants to trade,
**I want** the backend to handle buy/sell orders and track my portfolio,
**so that** trades execute instantly and my positions are always accurate.

**Acceptance Criteria:**

1. **Given** the app is running, **when** `GET /api/portfolio` is called, **then** it returns `{cash, positions: [{ticker, quantity, avg_cost, current_price, unrealized_pnl, pnl_pct}], total_value}` with all fields in `snake_case`.
2. **Given** a user submits `POST /api/portfolio/trade` with `{ticker, quantity, side: "buy"}` and has sufficient cash, **then** the trade executes at current price from `PriceCache.get(ticker)`, `positions` is upserted with weighted avg cost, `cash_balance` decreases, a `trades` row is appended, a portfolio snapshot is recorded immediately, and the response contains the updated portfolio.
3. **Given** a user submits a buy order with insufficient cash, **when** the trade is validated, **then** the API returns HTTP 400 with `{"error": "Insufficient cash", "code": "INSUFFICIENT_CASH"}` and no DB state changes.
4. **Given** a user submits `POST /api/portfolio/trade` with `{side: "sell"}` and owns sufficient shares, **then** cash increases by `quantity × current_price`, position quantity decreases (row deleted if quantity reaches 0), snapshot recorded immediately.
5. **Given** a user submits a sell order for more shares than owned, **when** validated, **then** API returns HTTP 400 with `{"error": "Insufficient shares", "code": "INSUFFICIENT_SHARES"}`.
6. **Given** `GET /api/portfolio/history` is called, **then** it returns an array of `{recorded_at, total_value}` snapshots in ascending time order.

---

### Story 2.2: Portfolio Snapshot Background Task

**As a** user tracking portfolio performance,
**I want** my portfolio value recorded automatically over time,
**so that** the P&L chart shows meaningful history even without trading.

**Acceptance Criteria:**

1. **Given** the app starts, **when** the `lifespan` context manager initializes, **then** a portfolio snapshot background task starts alongside the market data task.
2. **Given** the snapshot task is running, **when** 30 seconds elapse, **then** a new row is inserted into `portfolio_snapshots` with `total_value` computed as `cash + sum(position.quantity × PriceCache.get(ticker))` for all positions.
3. **Given** the snapshot task is running, **when** it executes, **then** it does not block or delay any API responses (NFR5 — runs as a background async loop, not in request path).
4. **Given** `GET /api/portfolio/history` is called immediately after a fresh install with no trades, **then** it returns an empty array (no snapshots until first snapshot interval or trade).
5. **Given** a trade executes via `POST /api/portfolio/trade`, **when** the trade handler runs, **then** a snapshot is also recorded inline (in addition to the 30-second background task).

---

### Story 2.3: Positions Table & Portfolio Header

**As a** user managing my portfolio,
**I want** to see all my positions with live P&L and my portfolio value in the header,
**so that** I know exactly where I stand at all times.

**Acceptance Criteria:**

1. **Given** the user has positions, **when** the `PositionsTable` renders, **then** it shows columns: Ticker · Qty · Avg Cost · Price · Unrealized P&L · %; all numeric cells use JetBrains Mono font.
2. **Given** a price update arrives, **when** the positions table re-renders, **then** `current_price`, `unrealized_pnl`, and `pnl_pct` update live from `priceStore` (no refetch needed for price updates — only on trade execution).
3. **Given** P&L is positive, **when** rendered, **then** it shows explicit `+` prefix in `green-up` color; negative shows `−` (U+2212) in `red-down` color (UX-DR20 — sign and color always agree).
4. **Given** the user has no positions, **when** the table renders, **then** it shows muted text: "No positions — buy something to get started" (no illustrations, no icons).
5. **Given** the `Header` renders, **when** portfolio value updates, **then** it displays: live total portfolio value (from `portfolioStore`), cash balance, and `StatusDot`; brand logo in `accent-yellow`; all within 48px fixed height.

---

### Story 2.4: Trade Bar UI

**As a** user who wants to execute trades,
**I want** a trade bar with ticker and quantity inputs plus buy/sell buttons,
**so that** I can place market orders instantly from the UI.

**Acceptance Criteria:**

1. **Given** the `TradeBar` renders, **when** inspecting its inputs, **then** both ticker and quantity fields use flat border-bottom style only (`border: none; border-bottom: 1px solid var(--border); background: transparent`), no border-radius, focus state changes border-bottom to `blue-primary`.
2. **Given** a user clicks a watchlist row, **when** `selectedTicker` updates in the store, **then** the `TradeBar` ticker input pre-fills with that ticker symbol automatically.
3. **Given** a user fills in ticker + quantity and clicks Buy or Sell, **when** the request is in flight, **then** both buttons are disabled with 40% opacity and `cursor: not-allowed`.
4. **Given** a buy/sell trade executes successfully, **when** the response returns, **then** `portfolioStore` is refetched from `GET /api/portfolio` (never optimistic update), positions table and header value update immediately — no toast notification.
5. **Given** a trade fails validation (e.g., insufficient cash), **when** the error response arrives, **then** inline red error text appears below the trade bar inputs (persistent until next submit attempt) — no toast notification (UX-DR16, FR29).

---

### Story 2.5: Watchlist Management UI

**As a** user who wants to track specific stocks,
**I want** to add and remove tickers from my watchlist,
**so that** I can customize which prices I see.

**Acceptance Criteria:**

1. **Given** the watchlist panel renders, **when** the user hovers over a watchlist row, **then** an `×` remove button is revealed (not permanently visible); clicking it calls `DELETE /api/watchlist/{ticker}`.
2. **Given** a ticker is removed successfully, **when** the API responds, **then** the row disappears immediately (refetch from `GET /api/watchlist`) — no toast notification (FR30).
3. **Given** the add-ticker input at the bottom of the watchlist panel, **when** a user types a ticker and presses Enter, **then** `POST /api/watchlist` is called with `{ticker}`.
4. **Given** the add request succeeds, **when** the response returns, **then** the new row appears immediately with a `—` price placeholder until the next SSE event — no toast (FR30).
5. **Given** the add request fails (e.g., duplicate ticker, invalid ticker), **when** the error arrives, **then** inline error text appears below the add-ticker input in red — persistent until next submit — no toast (FR30).

---

### Story 2.6: Portfolio Heatmap

**As a** user who wants a visual overview of my portfolio,
**I want** a treemap heatmap showing positions sized by weight and colored by P&L,
**so that** I can instantly identify my biggest winners and losers.

**Acceptance Criteria:**

1. **Given** the user has positions, **when** the `PortfolioHeatmap` renders, **then** each position is a `div` with `flex-basis` proportional to its weight (position value / total portfolio value).
2. **Given** a position has positive P&L, **when** the cell renders, **then** its background interpolates toward `green-up (#3fb950)` based on P&L%; negative P&L interpolates toward `red-down (#f85149)`.
3. **Given** the heatmap renders, **when** inspecting each cell, **then** it has `aria-label="TICKER +X.X%"` (or `−X.X%` with U+2212) for accessibility.
4. **Given** the user has no positions, **when** the heatmap renders, **then** it shows muted text: "No positions — buy something to get started".
5. **Given** prices update via SSE, **when** `priceStore` updates, **then** heatmap cell sizes and colors update live without requiring a portfolio refetch.

---

### Story 2.7: P&L History Chart

**As a** user tracking my performance over time,
**I want** a line chart showing my total portfolio value history,
**so that** I can see whether my trading is profitable.

**Acceptance Criteria:**

1. **Given** the P&L History tab is active, **when** the chart renders, **then** it uses Lightweight Charts with a line series plotting `{time: recorded_at, value: total_value}` from `GET /api/portfolio/history`.
2. **Given** no snapshots exist yet, **when** the chart renders, **then** it shows muted text: "No history yet — portfolio snapshots appear after your first trade" (no chart, no skeleton).
3. **Given** a trade executes, **when** the trade response returns, **then** `portfolioStore` is refetched which also triggers a history refetch, and the new snapshot point appears on the chart.
4. **Given** the `TabStrip` renders below the main chart, **when** inspecting it, **then** it shows tabs: Heatmap · Positions · P&L History; active tab has blue bottom border; 30px fixed height; tab switching is instant (no transition animation).
5. **Given** the P&L History chart renders, **when** the portfolio history has data, **then** the chart uses the same dark theme as the main chart (background `#0d1117`, grid `#30363d`).

---

## Epic 3: AI Trading Assistant

### Story 3.1: Chat API with Portfolio Context

**As a** user chatting with the AI,
**I want** the backend to send my full portfolio context to the LLM,
**so that** the AI gives relevant, personalized responses.

**Acceptance Criteria:**

1. **Given** `POST /api/chat` is called with `{message: "..."}`, **when** the handler runs, **then** it loads current portfolio state (cash, positions with live prices from `PriceCache`, watchlist, total value) and injects it into the LLM system prompt.
2. **Given** the chat handler constructs the LLM request, **when** it calls LiteLLM via OpenRouter, **then** it uses model string `openrouter/openrouter/free` (hardcoded in `chat/service.py` — never from config), with structured output schema `{message, trades?, watchlist_changes?}`.
3. **Given** the LLM returns a valid structured response, **when** parsed, **then** any `trades` items are auto-executed via the same trade validation logic as manual trades (INSUFFICIENT_CASH/INSUFFICIENT_SHARES errors are collected, not thrown).
4. **Given** trades are auto-executed, **when** the chat response is constructed, **then** it includes execution results (success or error per trade) alongside the LLM message, and the conversation turn is stored in `chat_messages` with `actions` JSON.
5. **Given** `watchlist_changes` are present in the LLM response, **when** processed, **then** add/remove operations execute and results are included in the response.
6. **Given** `GET /api/chat` history is needed, **when** the chat handler loads conversation context, **then** it reads recent messages from `chat_messages` table to maintain conversation continuity.

---

### Story 3.2: Chat Panel UI

**As a** user chatting with the AI assistant,
**I want** a terminal-styled chat panel with distinct message types,
**so that** I can clearly read AI analysis, my messages, and trade execution results.

**Acceptance Criteria:**

1. **Given** the chat panel renders on page load, **when** the `ChatLog` displays, **then** it shows an AI greeting message pre-loaded (before any user input), using `.log-ai-label` row style (18px purple avatar dot + "AI" text + timestamp).
2. **Given** a user types a message and submits, **when** the message is sent, **then** it appears as a `.log-user` row with yellow `> ` prefix, the input clears, and an animated `...` cursor appears on a new `.log-ai-label` row (the only loading indicator in the app — UX-DR18).
3. **Given** the AI response arrives, **when** rendered, **then** the `...` cursor is replaced with the response text using `.log-ai` style (blue left border, indented); any executed trades appear as `.log-exec-ok` (green) or `.log-exec-fail` (red) lines below the message.
4. **Given** the chat input renders, **when** inspecting it, **then** it shows `>` prefix, flat underline field in JetBrains Mono, rectangular purple "Send" button (uppercase, zero border-radius); Enter key submits; placeholder text: `"buy 10 AAPL · analyze portfolio"`.
5. **Given** the `ChatPanel` is wrapped in a React error boundary, **when** an unhandled error occurs inside it, **then** the error is contained — the watchlist, chart, and trade bar continue to function normally (FR27, ARCH-23).

---

### Story 3.3: AI Error Handling & Mock Mode

**As a** developer testing the app,
**I want** the AI to fail gracefully and support mock mode,
**so that** chat failures never break the terminal and tests run without real API calls.

**Acceptance Criteria:**

1. **Given** the LLM API call times out or returns an error, **when** the chat handler catches it, **then** the API returns HTTP 503 with `{"error": "LLM request failed", "code": "LLM_ERROR"}` — no unhandled exceptions propagate.
2. **Given** an AI error response is received by the frontend, **when** displayed, **then** a `.log-exec-fail` row appears in the chat log with the error description and a "Retry" affordance — the rest of the UI is unaffected (FR26, NFR7).
3. **Given** `LLM_MOCK=true` is set, **when** `POST /api/chat` is called, **then** it returns a hardcoded `ChatResponse` fixture (includes a sample buy trade for E2E coverage) with zero LiteLLM calls (ARCH-8, NFR13).
4. **Given** `OPENROUTER_API_KEY` is absent or empty, **when** the app starts, **then** it starts without error; chat calls that reach the LLM handler return `LLM_ERROR` — no crash, no key logged (NFR10, NFR14).
5. **Given** a chat error occurs, **when** the user clicks Retry, **then** the same message is re-submitted to `POST /api/chat`.

---

## Epic 4: Deployment & Quality

### Story 4.1: Dockerfile & Container Build

**As a** user who wants to run the app,
**I want** a single Docker command to build and start everything,
**so that** there's no manual setup beyond providing an API key.

**Acceptance Criteria:**

1. **Given** the `Dockerfile` exists, **when** `docker build` runs, **then** Stage 1 (Node 20 slim) installs frontend deps and runs `npm run build` producing `frontend/out/`; Stage 2 (Python 3.12 slim) installs uv, copies backend, runs `uv sync`, copies `frontend/out/` into the image.
2. **Given** the image is built, **when** `docker run -v finally-data:/app/db -p 8000:8000 --env-file .env finally` runs, **then** the app starts on port 8000, the SQLite DB initializes if missing, and `GET /api/health` returns `{"status": "ok"}` (FR35).
3. **Given** the container runs with `MASSIVE_API_KEY` absent, **when** the market data task starts, **then** the built-in simulator runs without error (NFR14).
4. **Given** `.env.example` is committed, **when** inspecting it, **then** it contains `OPENROUTER_API_KEY`, `MASSIVE_API_KEY`, and `LLM_MOCK` variables with placeholder values and comments — no real keys.
5. **Given** the container stops and restarts with the same volume, **when** the app loads, **then** all portfolio state (positions, cash, watchlist, trades) is preserved (FR32, NFR9).

---

### Story 4.2: Makefile & Scripts

**As a** developer managing the app lifecycle,
**I want** Makefile targets and platform scripts for common operations,
**so that** starting, stopping, and testing the app is a single command.

**Acceptance Criteria:**

1. **Given** the `Makefile` exists, **when** `make start` runs, **then** it builds the image (if needed) and starts the container; `make stop` stops and removes the container (not the volume); `make build` forces a rebuild; `make logs` tails container logs; `make test` runs E2E tests; `make clean` prompts for confirmation before removing the volume.
2. **Given** `scripts/start_mac.sh` runs, **when** executed on macOS/Linux, **then** it builds if needed, starts the container with volume + port + env-file, and prints `http://localhost:8000`.
3. **Given** `scripts/start_windows.ps1` runs, **when** executed on Windows PowerShell, **then** it performs the same operations as the macOS script.
4. **Given** any script is run multiple times, **when** the container already exists, **then** the script handles the existing container gracefully (idempotent — FR37).
5. **Given** `scripts/stop_mac.sh` or `stop_windows.ps1` runs, **when** executed, **then** the container stops and is removed, but the `finally-data` volume is preserved.

---

### Story 4.3: Playwright E2E Tests

**As a** developer ensuring the app works end-to-end,
**I want** Playwright tests covering critical user flows,
**so that** regressions are caught before deployment.

**Acceptance Criteria:**

1. **Given** `test/docker-compose.test.yml` exists, **when** it runs, **then** it starts the app container (with `LLM_MOCK=true`) and a Playwright container, with the test container able to reach the app at `http://app:8000`.
2. **Given** the E2E suite runs, **when** the fresh-start test executes, **then** it verifies: 10 default tickers visible, `$10,000.00` cash shown, at least one price update received (StatusDot green), and the main chart renders.
3. **Given** the watchlist tests run, **when** add-ticker flow executes, **then** typing a valid ticker (e.g., "PYPL") and pressing Enter adds a row; clicking the `×` on that row removes it.
4. **Given** the trading tests run, **when** a buy order is submitted (e.g., 5 shares of AAPL), **then** cash decreases by approximately `5 × current_price`, a position row appears in the positions table, and the heatmap shows an AAPL cell.
5. **Given** the AI chat test runs with `LLM_MOCK=true`, **when** a message is sent, **then** the mock response appears in the chat log, and any mock trade execution appears as a `.log-exec-ok` line.
6. **Given** `make test` runs, **when** all specs pass, **then** the exit code is 0; on failure, Playwright screenshots are saved to `test/screenshots/`.
