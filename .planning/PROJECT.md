# FinAlly — AI Trading Workstation

## What This Is

FinAlly (Finance Ally) is a visually stunning AI-powered trading workstation that streams live market data, enables simulated portfolio trading, and integrates an LLM chat assistant capable of analyzing positions and executing trades via natural language. Built as the capstone for an agentic AI coding course, it demonstrates how orchestrated AI agents can produce a production-quality full-stack application from scratch.

## Core Value

A Bloomberg-terminal-style UI with streaming live prices and an AI copilot that actually executes trades — together showcasing the full-stack power of orchestrated AI agents building a real product end-to-end.

## Requirements

### Validated

- ✓ Market data abstraction interface (`MarketDataSource` ABC) — existing
- ✓ GBM simulator with correlated moves, drift/volatility, random events — existing
- ✓ Massive API (Polygon.io) REST poller conforming to same interface — existing
- ✓ Thread-safe in-memory `PriceCache` for latest prices — existing
- ✓ SSE streaming endpoint `/api/stream/prices` reading from price cache — existing
- ✓ Market data background task (simulator or Massive, env-driven) — existing
- ✓ Unit tests for market data: 73 passing, 84% coverage — existing
- ✓ Chat API: LLM integration with structured outputs, auto-execute trades — Validated in Phase 3: LLM Chat Integration
- ✓ LiteLLM → OpenRouter (Cerebras) client for structured chat responses — Validated in Phase 3
- ✓ System prompt with portfolio context injection (fresh prose on every request) — Validated in Phase 3
- ✓ Structured output: message + trades + watchlist_changes — Validated in Phase 3
- ✓ Auto-execute validated trades from LLM response (continue-and-report partial failures) — Validated in Phase 3
- ✓ Mock mode (LLM_MOCK=true) for deterministic testing — Validated in Phase 3
- ✓ Chat message history persists in `chat_messages` table — Validated in Phase 3

### Active

**Backend API & Application**
- [ ] FastAPI application entry point with lifespan management
- [ ] SQLite database with lazy initialization and default seed data
- [ ] Portfolio API: positions, cash balance, trade execution, P&L history
- [ ] Watchlist API: list, add, remove tickers
- [ ] Health check endpoint
- [ ] Portfolio snapshot background task (every 30s + after each trade)

**Frontend**
- [ ] Next.js TypeScript project with static export
- [ ] Dark terminal aesthetic (Bloomberg-inspired, Tailwind CSS)
- [ ] Watchlist panel: prices, flash animations, sparklines from SSE stream
- [ ] Main chart area for selected ticker (price over time)
- [ ] Portfolio treemap/heatmap (positions sized by weight, colored by P&L)
- [ ] P&L line chart (total portfolio value over time)
- [ ] Positions table: ticker, qty, avg cost, price, unrealized P&L
- [ ] Trade bar: ticker, quantity, buy/sell buttons (market orders)
- [ ] AI chat panel: message history, loading indicator, inline trade confirmations
- [ ] Header: portfolio value (live), cash balance, connection status dot
- [ ] SSE EventSource client with auto-reconnect

**Infrastructure & Deployment**
- [ ] Multi-stage Dockerfile (Node build → Python runtime)
- [ ] FastAPI serving Next.js static export on port 8000
- [ ] Docker volume for SQLite persistence
- [ ] Start/stop scripts (macOS/Linux shell + Windows PowerShell)

**Testing**
- [ ] Backend unit tests: portfolio logic, trade execution, LLM response parsing
- [ ] Frontend unit tests: component rendering, price flash, watchlist CRUD
- [ ] E2E Playwright tests: full user flows, LLM mock mode

### Out of Scope

- User authentication / multi-user — hardcoded `user_id="default"` is sufficient; schema supports future migration
- Limit orders, partial fills, order books — market orders only, dramatically simpler math
- Real-time WebSockets — SSE is sufficient for one-way push
- Postgres / external database — SQLite is self-contained, zero config
- Cloud deployment (Terraform, App Runner) — Docker single-container is the delivery target
- Mobile-optimized UI — desktop-first; tablet functional

## Context

- **Course context:** Capstone project for a Udemy agentic AI coding course; agents interact through files in `planning/`. The codebase is built entirely by AI agents demonstrating orchestrated code generation.
- **What's done:** Market data subsystem is complete and well-tested — `backend/app/market_data/` with simulator, Massive API client, price cache, and SSE endpoint.
- **What's remaining:** FastAPI app server, database, all API endpoints, LLM integration, the entire frontend, Docker multi-stage build, start/stop scripts, and E2E tests.
- **Environment:** OPENROUTER_API_KEY in `.env` (gitignored). MASSIVE_API_KEY optional. LLM_MOCK for testing.
- **Local dev:** `uv` for Python, `npm`/`vite` for frontend. Docker for delivery.

## Constraints

- **Architecture:** Single Docker container on port 8000 — no docker-compose, no service orchestration
- **Runtime:** Python 3.12 + uv; Node 20 for frontend build stage
- **Database:** SQLite only — no Postgres, no migrations, lazy init on startup
- **API:** Market orders only — no limit orders, no order book
- **Frontend:** Next.js static export (`output: 'export'`) served by FastAPI
- **LLM:** LiteLLM → OpenRouter → Cerebras (`openrouter/openai/gpt-oss-120b`) with structured outputs
- **No auth:** Single default user, hardcoded `user_id="default"`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SSE over WebSockets | One-way push is sufficient; simpler, universal browser support | — Pending |
| Static Next.js export | Single origin, no CORS, one port, one container | — Pending |
| SQLite over Postgres | No multi-user = no need for a DB server; zero config | — Pending |
| Market orders only | Eliminates order book complexity; simpler portfolio math | — Pending |
| LiteLLM → OpenRouter | Abstraction layer; Cerebras for fast inference | — Pending |
| GBM simulator default | No API key needed; realistic price simulation with correlations | ✓ Validated |
| Abstract market data interface | Swappable simulator/Massive without downstream changes | ✓ Validated |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-10
