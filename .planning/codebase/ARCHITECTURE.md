# Architecture

**Last updated: 2026-04-09**

## Summary

FinAlly is a single-container, single-port AI trading workstation composed of a FastAPI backend (Python/uv) serving a static Next.js frontend. Market data flows through a unified abstraction (simulator or Massive API) into an in-memory price cache, which feeds both SSE streaming and trade execution. The system persists state to SQLite and integrates with LLM via OpenRouter for chat-based trading.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Docker Container (port 8000)                               │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  FastAPI Application                                 │  │
│  │                                                      │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │  Market Data Subsystem                         │ │  │
│  │  │  ├─ SimulatorDataSource (GBM, default)        │ │  │
│  │  │  ├─ MassiveDataSource (REST polling)          │ │  │
│  │  │  └─ PriceCache (thread-safe in-memory store)  │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  │           ↓                    ↓                     │  │
│  │  ┌──────────────────┐   ┌──────────────────┐        │  │
│  │  │ SSE Stream Endpoint   │ Portfolio APIs      │        │  │
│  │  │ /api/stream/prices    │ /api/portfolio/*    │        │  │
│  │  └──────────────────┘   │ /api/chat/*         │        │  │
│  │                          │ /api/watchlist/*    │        │  │
│  │                          └──────────────────┘        │  │
│  │                                 ↓                     │  │
│  │                          ┌─────────────────┐         │  │
│  │                          │ SQLite Database │         │  │
│  │                          │ (volume-mounted)│         │  │
│  │                          └─────────────────┘         │  │
│  │                                                      │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │  Static File Serving (Next.js build output)    │ │  │
│  │  │  /index.html, /js/*, /css/*, etc.             │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  External Services (via environment variables)       │  │
│  │  ├─ OpenRouter (LLM chat via LiteLLM)              │  │
│  │  └─ Polygon.io via Massive (optional real data)    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Architectural Pattern

**Layered + Dependency Injection Pattern:**

1. **Presentation Layer** — Static-exported Next.js frontend served from `FastAPI` static files
2. **API Gateway Layer** — FastAPI routers for REST endpoints (`/api/*`) and SSE streams
3. **Domain/Service Layer** — Market data abstraction (simulator/Massive), portfolio logic, LLM chat
4. **Data Access Layer** — SQLite via direct SQL or ORM (to be determined by backend implementation)
5. **External Integration** — OpenRouter (LLM), Polygon.io/Massive (market data)

**Key Principle:** Abstraction via interfaces. The market data subsystem defines `MarketDataSource` (ABC), allowing `SimulatorDataSource` or `MassiveDataSource` to be swapped without affecting SSE streaming or portfolio code.

## Market Data Flow

### Architecture

```
┌─────────────┐
│  Simulator  │ (GBMSimulator with Cholesky-correlated moves)
└──────┬──────┘
       │  OR
       │
┌──────┴──────┐
│   Massive   │ (REST polling of Polygon.io)
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│     PriceCache              │
│  (Thread-safe in-memory)    │
│  {ticker → PriceUpdate}     │
│  Version counter (for SSE)  │
└──────┬───────┬──────────────┘
       │       │
       ▼       ▼
   SSE Stream  Portfolio / Trade Execution
```

### Data Sources

**SimulatorDataSource** (`backend/app/market/simulator.py`):
- **Backing**: `GBMSimulator` — Geometric Brownian Motion with configurable drift/volatility per ticker
- **Correlation**: Cholesky decomposition of sector-based correlation matrix
  - Tech stocks (AAPL, GOOGL, MSFT, NVDA, META, TSLA): intra-correlation 0.6 (or 0.3 for TSLA)
  - Finance stocks (JPM, V): intra-correlation 0.5
  - Cross-sector: 0.3
- **Random Events**: ~0.1% chance per tick of 2–5% shock move
- **Update Interval**: 500ms (configurable)
- **Lifecycle**: `await source.start(tickers)` spawns background task → `await source.stop()` cancels

**MassiveDataSource** (`backend/app/market/massive_client.py`):
- **Backing**: REST polling via `massive` package (Polygon.io)
- **Trigger**: Only created if `MASSIVE_API_KEY` environment variable is set and non-empty
- **Rate**: Free tier 5 calls/min (poll every 15s); paid tiers up to 2–15s
- **Parsing**: REST response mapped to same `PriceUpdate` format as simulator

**Factory** (`backend/app/market/factory.py`):
- `create_market_data_source(price_cache)` inspects `MASSIVE_API_KEY` and returns appropriate source

### PriceCache

`backend/app/market/cache.py` — Thread-safe in-memory store:
- **Key Structure**: `{ticker → PriceUpdate}`
- **PriceUpdate**: Frozen dataclass with computed properties: `change`, `change_percent`, `direction` ("up"/"down"/"flat")
- **Thread Safety**: Lock guards all read/write operations
- **Version Counter**: Monotonically incremented on every update; enables SSE endpoint to detect changes without polling
- **API**:
  - `update(ticker, price, timestamp=None) → PriceUpdate` — record new price, return update
  - `get(ticker) → PriceUpdate | None` — fetch latest price
  - `get_all() → dict[str, PriceUpdate]` — snapshot of all prices
  - `remove(ticker)` — delete (e.g., when removed from watchlist)

### SSE Streaming

`backend/app/market/stream.py`:
- **Endpoint**: `GET /api/stream/prices` (text/event-stream)
- **Transport**: Server-Sent Events (SSE) — simpler than WebSockets, one-way push, browser auto-reconnect
- **Payload**: Every 500ms, sends all tickers' `PriceUpdate` as JSON:
  ```json
  data: {
    "AAPL": {"ticker": "AAPL", "price": 190.50, "change": 0.25, "direction": "up", ...},
    "GOOGL": {...}
  }
  ```
- **Change Detection**: Only emits if `price_cache.version` has changed since last send
- **Reconnection**: Includes `retry: 1000` header; browser's `EventSource` auto-reconnects after 1s disconnect

## Trade Execution Flow

### Portfolio State

**Database Schema** (SQLite):
- `users_profile` — cash balance (default user hardcoded as `"default"`)
- `positions` — holdings: ticker, quantity, avg_cost, updated_at
- `trades` — append-only log: ticker, side (buy/sell), quantity, price, executed_at
- `portfolio_snapshots` — value over time (sampled every 30s + immediately post-trade)

### Trade Endpoint

`POST /api/portfolio/trade` — Request body:
```json
{
  "ticker": "AAPL",
  "side": "buy",
  "quantity": 10
}
```

**Execution**:
1. Fetch latest price from `PriceCache`
2. Validate cash (for buys) or shares (for sells)
3. Atomically update `positions` table and `users_profile.cash_balance`
4. Append to `trades` table (audit log)
5. Record `portfolio_snapshots` entry with new total value
6. Return updated portfolio state

**Error Handling**: Insufficient cash or shares returns error response; trade is not executed.

## LLM Integration Flow

### Chat Endpoint

`POST /api/chat` — Request body:
```json
{
  "message": "Buy 10 shares of AAPL"
}
```

**Execution**:
1. Load portfolio context: cash, positions (with live prices), watchlist, total value
2. Load recent conversation history from `chat_messages` table
3. Construct system prompt + context + history + user message
4. Call **LiteLLM** → **OpenRouter** → **Cerebras** (fast inference)
5. Request **Structured Output** (JSON) with schema:
   ```json
   {
     "message": "Your response here",
     "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 10}],
     "watchlist_changes": [{"ticker": "PYPL", "action": "add"}]
   }
   ```
6. Parse response; validate and auto-execute any trades/watchlist changes
7. Store message + executed actions in `chat_messages`
8. Return complete JSON to frontend (no streaming; Cerebras is fast)

**Trade Auto-Execution**: Trades in the LLM response execute through the same validation as manual trades.

**Environment Variables**:
- `OPENROUTER_API_KEY` — required; enables LLM chat
- `LLM_MOCK=true` — optional; returns deterministic mock responses for tests

## Watchlist Management

### State

`watchlist` table in SQLite: `(user_id, ticker, added_at)`

### Endpoints

- `GET /api/watchlist` — fetch tickers with latest prices
- `POST /api/watchlist` — add ticker: `{"ticker": "TSLA"}`
- `DELETE /api/watchlist/{ticker}` — remove ticker

### Subscription Model

Tickers in the watchlist drive which ones the market data source actively tracks:
1. Backend starts with default 10 tickers (AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX)
2. When user adds ticker via REST or LLM → `await source.add_ticker(ticker)`
3. When user removes ticker → `await source.remove_ticker(ticker)`; ticker is also removed from `PriceCache`

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

All components use constructor injection to avoid globals:

```python
# Factory creates dependencies
price_cache = PriceCache()
source = create_market_data_source(price_cache)
stream_router = create_stream_router(price_cache)

# FastAPI app wires them together
app = FastAPI()
app.include_router(stream_router)
app.include_router(create_portfolio_router(price_cache, db))
app.include_router(create_chat_router(price_cache, db, llm_client))
```

This enables testing without side effects and allows easy swapping of implementations.

## Error Handling

**Strategy:** Fail fast with informative error responses.

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

Schema already includes `user_id` column. To enable multi-user:
1. Add authentication layer (JWT or session)
2. Replace hardcoded `"default"` with `request.user.id`
3. Partition SQLite or migrate to Postgres
4. Scope watchlists, portfolios, and chat history per user

---

**Architecture analysis: 2026-04-09**
