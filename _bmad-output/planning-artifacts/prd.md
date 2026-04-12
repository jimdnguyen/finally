---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
inputDocuments: ['planning/PLAN.md', 'planning/MARKET_DATA_SUMMARY.md']
workflowType: 'prd'
classification:
  projectType: web_app
  domain: fintech
  complexity: medium
  projectContext: brownfield
---

# Product Requirements Document - finally

**Author:** Jim
**Date:** 2026-04-11

## Executive Summary

FinAlly (Finance Ally) is a browser-based AI trading workstation that streams simulated live market data, supports manual and AI-driven portfolio management, and integrates a conversational LLM assistant capable of executing trades and managing watchlists through natural language. It is the capstone project of an agentic AI coding course — built entirely by orchestrated AI coding agents to demonstrate what production-quality, full-stack agentic software development looks like in practice.

Target audience: developers and students in the agentic AI coding course who want a concrete, impressive reference implementation of an agent-built application. No financial background required. No real money involved. The trading terminal is the stage; the agent is the star.

### What Makes This Special

FinAlly's differentiator is the seamless execution loop between the human and the AI. Unlike chatbots that advise and stop, FinAlly's assistant acts — buying shares, selling positions, adding tickers — immediately and without confirmation dialogs. In a zero-stakes simulated environment this creates a viscerally compelling demo of agentic capability: the user says "rebalance my portfolio toward tech" and it happens.

The Bloomberg terminal aesthetic reinforces the effect. The dense, data-rich UI signals professional-grade software, making the AI's autonomy feel more significant. This is not a toy chatbot bolted onto a spreadsheet — it is a working trading workstation where the AI is a first-class operator.

The deeper insight: the product itself is an argument. Every pixel demonstrates that AI agents can build production software, and every trade the AI executes demonstrates that AI agents can operate it.

## Project Classification

- **Project Type:** Web application — Next.js SPA (static export), served by FastAPI, desktop-first
- **Domain:** Fintech — trading, portfolio management, market data; simulated/educational scope (no real-money compliance requirements)
- **Complexity:** Medium — fintech signals present; regulatory, KYC/AML, and PCI DSS concerns are out of scope
- **Project Context:** Brownfield — market data layer (SSE streaming, simulator, price cache) is complete; portfolio management, AI chat, and full frontend remain to be built

## Success Criteria

### User Success

- Prices visibly update on screen — tickers flash green/red and sparklines fill in progressively. The terminal *feels alive* within seconds of page load.
- A trade executed manually (via trade bar) immediately appears in the positions table with correct quantity, cost, and P&L.
- A trade executed via AI chat appears in the positions table and is confirmed in the AI's response text.
- The AI assistant responds coherently to portfolio questions and trade requests — it understands context (current holdings, cash balance) and acts on it.
- Toast notifications surface significant events: trade executed, ticker added/removed from watchlist, large price moves.

### Business Success

- The full application runs from a single Docker command with no setup beyond providing an API key.
- The project serves as a compelling, shareable capstone demo — a developer watching a 2-minute screen recording understands immediately what agentic AI coding can produce.

### Technical Success

- SSE price stream delivers updates at ~500ms intervals, consistent with industry-standard trading terminal feel.
- AI chat works reliably end-to-end — structured output parsed correctly, trades auto-executed, errors surfaced in chat if a trade fails validation.
- LLM calls use `openrouter/openrouter/free` via LiteLLM. Response latency is secondary to correctness and reliability.
- All components pass their defined unit tests; E2E tests pass in the Docker test environment with `LLM_MOCK=true`.

### Measurable Outcomes

- Fresh Docker start → prices streaming in under 30 seconds.
- Manual buy/sell → positions table updates in under 1 second.
- AI trade request → executed and confirmed within the chat response.
- Zero broken states on first-load for a clean database.

## Product Scope

### MVP — Minimum Viable Product

Everything defined in `planning/PLAN.md`:
- Watchlist panel with live SSE price stream, sparklines, flash animations
- Main chart area (click ticker to view)
- Portfolio heatmap (treemap by position weight, colored by P&L)
- P&L chart (portfolio value over time)
- Positions table (ticker, qty, avg cost, current price, unrealized P&L)
- Trade bar (buy/sell market orders, instant fill)
- AI chat panel with auto-execution of trades and watchlist changes
- Header: total value, cash balance, connection status indicator
- Single Docker container, port 8000, SQLite, no login
- Toast notifications for trades and significant events

### Growth Features (Post-MVP)

- User authentication and multi-user support
- Random low-probability bull/bear market events (~0.00001% chance per tick) with toast alerts ("MARKET FLASH: Bull run triggered!")
- Enhanced toast notification system for price milestone alerts

### Vision (Future)

- Fully animated terminal — every value in motion, smooth transitions throughout
- AI chat assistant is polished and context-aware across long sessions
- An autonomous "AI trader" persona — a separate simulated agent with its own portfolio, making independent buy/sell decisions visible in real time on screen, creating a sense of a living market with multiple participants

## User Journeys

### Journey 1: The Course Student — First Launch & Core Experience

**Meet Alex.** Alex just finished the agentic AI coding module and wants to see the capstone in action. They run `./scripts/start_windows.ps1`, wait 20 seconds, and a browser opens to `http://localhost:8000`.

The terminal loads. Ten tickers fill the watchlist — AAPL, NVDA, TSLA — prices already ticking. Green flash. Red flash. Sparklines filling in. Alex leans forward.

They click NVDA. The main chart area updates with NVDA's price history since page load. They type `10` in the quantity field, hit **Buy**. A toast pops: *"Bought 10 × NVDA @ $487.32."* The positions table now shows NVDA with quantity, cost, and a P&L value that immediately starts moving.

Alex opens the chat panel. Types: *"How's my portfolio looking?"* The AI responds with a coherent summary — cash balance, NVDA position, concentration risk note. Alex types: *"Sell 5 NVDA and buy some AAPL."* The AI executes both trades and confirms them in its reply. The positions table updates in real time.

**Resolution:** Alex has a working Bloomberg-style terminal with an AI that actually trades. They screen-record it and share it with their cohort.

### Journey 2: The Course Student — Edge Cases & Recovery

**Same Alex, second session.** They try to sell 100 shares of TSLA — but they only own 10. They hit Sell. A toast appears: *"Insufficient shares."* The positions table doesn't change. Clean failure.

They ask the AI: *"Buy $50,000 of MSFT."* The AI responds in chat: *"Insufficient cash — you have $6,240 available. Want me to buy as many shares as possible instead?"* The trade didn't execute; the error is surfaced clearly.

The SSE connection drops (they toggled their VPN). The connection dot in the header flips yellow. Prices stop updating. Ten seconds later it reconnects automatically — dot goes green, prices resume mid-stream. Alex never touched anything.

Alex types a message in the chat panel and hits send. The loading indicator spins. And spins. The free model is under load — the request times out or returns an error. The chat panel shows a clear error message: *"Assistant unavailable — please try again."* The input field re-enables. Alex's message is still there; they hit send again. This time it responds. The app never froze — SSE kept running, prices kept ticking, positions stayed intact. Only the chat panel was affected.

**Resolution:** The app degrades gracefully and recovers cleanly. Errors are visible and informative without being disruptive. LLM failures are isolated and do not affect the rest of the UI.

### Journey 3: The Developer/Deployer

**Meet the instructor** setting up the demo environment before class. They clone the repo, add their `OPENROUTER_API_KEY` to `.env`, and run the start script. The container builds in ~2 minutes, health check at `/api/health` returns 200, browser opens automatically.

They want to verify the LLM mock works for the E2E test run. They set `LLM_MOCK=true`, run the Playwright suite via `docker-compose.test.yml`. All tests pass. They reset to `LLM_MOCK=false` for the live demo.

During the demo the Docker container is still running from yesterday — they run the start script again. It's idempotent; the existing container is reused, the SQLite volume is intact, the portfolio state from the previous session is preserved.

**Resolution:** Zero-friction setup and teardown. The instructor can demo confidently knowing the environment is reproducible and stateful across restarts.

### Journey Requirements Summary

| Capability | Revealed by |
|---|---|
| Live SSE price stream with flash animations | Journey 1 |
| Manual trade bar with instant fill | Journey 1 |
| Toast notification system | Journeys 1 & 2 |
| AI chat with portfolio context + trade execution | Journey 1 |
| Positions table real-time updates | Journey 1 |
| Trade validation (insufficient cash/shares) | Journey 2 |
| AI error surfacing in chat response | Journey 2 |
| Chat panel timeout/error state with retry | Journey 2 |
| LLM failure isolated from rest of UI | Journey 2 |
| SSE auto-reconnect with connection status indicator | Journey 2 |
| Single Docker command deploy, idempotent scripts | Journey 3 |
| `/api/health` endpoint | Journey 3 |
| `LLM_MOCK=true` mode for E2E testing | Journey 3 |
| SQLite volume persistence across restarts | Journey 3 |

## Innovation & Novel Patterns

### Detected Innovation Areas

**Agentic UI Pattern** — FinAlly demonstrates a UI paradigm where an LLM agent is a first-class operator of the application, not an assistant layer. The AI reads live application state (portfolio, prices, cash) and writes back to it (executes trades, modifies watchlist) through the same validated pathways as the human user. The chat panel is not a help widget — it is a second control surface for the application.

This pattern — natural language → structured output → validated state mutation → real-time UI update — is the core architectural innovation and the primary learning outcome of the capstone.

**Agentic Coding Demonstration** — The product itself is meta-innovative: a production-quality full-stack application built entirely by orchestrated AI coding agents, serving as a live proof-of-concept for agentic software development methodology.

### Validation Approach

- The demo moment is self-validating: user types a trade instruction in natural language, AI executes it, positions table updates. Either it works or it doesn't.
- Structured output schema enforces correctness — the LLM cannot return a malformed trade; the schema rejects it.
- `LLM_MOCK=true` allows deterministic E2E validation of the agentic execution loop without live API calls.

### Risk Mitigation

- Free-tier LLM latency is variable — UI must handle slow/failed responses gracefully without blocking the trading terminal.
- Structured output parsing must be robust — malformed or partial responses should surface as chat errors, not application crashes.
- Auto-execution with no confirmation is only safe because this is a simulated environment; this must be clearly communicated in the UI ("Simulated" label).

## Web Application Specific Requirements

### Project-Type Overview

FinAlly is a single-page application (SPA) built with Next.js (static export) and served by FastAPI on a single port. It is desktop-first, optimized for wide screens, and requires no server-side rendering or SEO. The primary interface is a dense, data-rich trading terminal with real-time SSE-driven price updates.

### Technical Architecture Considerations

- **Rendering:** Static export (`output: 'export'`) — all HTML/JS/CSS served as static files from FastAPI. No Next.js server required at runtime.
- **Real-time:** Native `EventSource` API for SSE connection to `/api/stream/prices`. Auto-reconnect handled by the browser's built-in EventSource retry.
- **State management:** Frontend holds live price state (for sparklines and flash effects) accumulated since page load. Portfolio and watchlist state fetched from REST API and refreshed after mutations.
- **Single origin:** Frontend and API share port 8000 — no CORS configuration needed.

### Browser Matrix

- **Target:** Modern desktop browsers — Chrome, Firefox, Edge (latest 2 versions)
- **Not supported:** IE, Opera Mini, mobile browsers (functional but not optimized)
- **Safari:** Best-effort; SSE and canvas charting should work but not a primary test target

### Responsive Design

- Desktop-first layout optimized for 1280px+ width
- Functional on tablet (≥768px) but not a design priority
- No mobile layout required

### Performance Targets

- Initial page load: under 3 seconds on localhost
- SSE price update rendering: under 100ms from event receipt to DOM update
- Trade execution (manual): under 1 second from button click to positions table update

### SEO Strategy

- None required — single-page app with no public indexing needed
- `<title>FinAlly — AI Trading Workstation</title>` for browser tab identification only

### Accessibility Level

- Semantic HTML and keyboard navigation for core interactions (trade bar, chat input)
- No formal WCAG compliance required — capstone demo scope

### Implementation Considerations

- Charting library: canvas-based preferred (Lightweight Charts or Recharts) for performance at 500ms update intervals
- CSS animations for price flash effects: brief background color transition on price change, ~500ms fade via CSS class toggle
- Tailwind CSS with custom dark theme (`#0d1117` background, accent yellow `#ecad0a`, blue `#209dd7`, purple `#753991`)

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Experience MVP — the minimum that makes the agentic demo compelling and the terminal feel alive. The goal is a 2-minute screen recording that impresses.

**Resource Requirements:** Solo developer + AI coding agents. Brownfield start (market data complete). All three user journeys (Course Student happy path, Course Student edge cases, Developer/Deployer) must be supported by MVP.

See [Product Scope](#product-scope) for the full MVP, Growth, and Vision feature lists.

### Risk Mitigation Strategy

**Technical Risks:** LLM integration chain (OpenRouter → LiteLLM → structured output) is the highest-risk integration. Mitigated by `LLM_MOCK=true` for testing, isolated error handling so LLM failures never break the trading terminal, and robust structured output parsing that rejects malformed responses gracefully.

**Resource Risks:** If scope must shrink, the portfolio heatmap (treemap) is the most complex UI component and can be deferred. Core demo remains fully functional with watchlist, positions table, trade bar, and AI chat.

## Functional Requirements

### Market Data & Price Streaming

- **FR1:** Users can view a live-updating list of watched tickers with current prices
- **FR2:** Users can see visual indicators (color, animation) when a price changes up or down
- **FR3:** Users can see a mini price chart (sparkline) for each watched ticker, built from live data since page load
- **FR4:** Users can see a connection status indicator showing whether the live data stream is active
- **FR5:** The system automatically reconnects to the live data stream after a connection loss

### Watchlist Management

- **FR6:** Users can view their current watchlist of tickers
- **FR7:** Users can add a ticker to their watchlist
- **FR8:** Users can remove a ticker from their watchlist
- **FR9:** The system seeds a default watchlist of 10 tickers on first launch

### Chart & Market Detail

- **FR10:** Users can select a ticker to view a larger detailed price chart
- **FR11:** The detail chart displays price history accumulated since page load

### Portfolio & Trading

- **FR12:** Users can view their current cash balance
- **FR13:** Users can view all current positions with quantity, average cost, current price, unrealized P&L, and % change
- **FR14:** Users can execute a market buy order for a specified ticker and quantity
- **FR15:** Users can execute a market sell order for a specified ticker and quantity
- **FR16:** The system rejects trades that exceed available cash (buy) or owned shares (sell) and surfaces an error
- **FR17:** Users can view a heatmap visualization of their portfolio, sized by position weight and colored by P&L
- **FR18:** Users can view a chart of their total portfolio value over time

### AI Chat Assistant

- **FR19:** Users can send natural language messages to an AI assistant
- **FR20:** The AI assistant responds with portfolio analysis, market observations, and trade suggestions
- **FR21:** The AI assistant can execute trades on the user's behalf via natural language instruction
- **FR22:** The AI assistant can add or remove tickers from the watchlist via natural language instruction
- **FR23:** Trades and watchlist changes executed by the AI are confirmed in the chat response
- **FR24:** The AI assistant has access to the user's current portfolio context (cash, positions, watchlist, live prices) when responding
- **FR25:** The system displays a loading indicator while waiting for an AI response
- **FR26:** The system displays an error message and allows retry when an AI response fails or times out
- **FR27:** AI chat failures do not affect the trading terminal, price stream, or other UI components

### Notifications

- **FR28:** Users receive a toast notification when a manual trade is executed
- **FR29:** Users receive a toast notification when a trade validation error occurs (insufficient cash/shares)
- **FR30:** Users receive a toast notification when a ticker is added or removed from the watchlist

### Portfolio History & Persistence

- **FR31:** The system records portfolio value snapshots over time for chart display
- **FR32:** Portfolio state (positions, cash, watchlist) persists across application restarts
- **FR33:** A fresh database initializes with default seed data ($10,000 cash, 10 default tickers)

### System & Operations

- **FR34:** The application is accessible via a single Docker command with no additional setup beyond an API key
- **FR35:** The system exposes a health check endpoint for operational monitoring
- **FR36:** The system supports a mock LLM mode for deterministic testing without live API calls
- **FR37:** Start and stop scripts are idempotent — safe to run multiple times without breaking state

## Non-Functional Requirements

### Performance
- NFR1: Price update events received via SSE must be rendered in the UI within 100ms of receipt
- NFR2: Manual trade execution (button click → positions table update) must complete within 1 second
- NFR3: Initial page load on localhost must complete within 3 seconds
- NFR4: The application must not drop frames or stutter during continuous 500ms SSE price updates
- NFR5: Portfolio snapshot recording (background task) must not block or delay API responses

### Reliability
- NFR6: The SSE connection must automatically recover from network interruptions without user action
- NFR7: LLM API failures (timeout, error, malformed response) must be isolated to the chat panel
- NFR8: The application must start cleanly from a fresh Docker volume with no manual database setup
- NFR9: The application must preserve all portfolio state across container restarts via the mounted SQLite volume

### Security
- NFR10: The OpenRouter API key must only be read from environment variables — never hardcoded or logged
- NFR11: The API must not expose any endpoint that can delete or corrupt the database without explicit user action

### Integration
- NFR12: LLM calls must use `openrouter/openrouter/free` via LiteLLM — must not be changed to paid model without explicit configuration
- NFR13: When `LLM_MOCK=true`, the system must return deterministic responses — no live API calls
- NFR14: If `MASSIVE_API_KEY` is absent or empty, the system must fall back to the built-in simulator without error
