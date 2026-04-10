# Architecture Research: FinAlly

**Last updated: 2026-04-09**

**Mode:** Ecosystem | **Confidence:** HIGH

---

## Summary

FinAlly's remaining architecture must integrate three core flows: (1) FastAPI application management with clean startup/shutdown, (2) SQLite database access with atomic trade execution, (3) LLM integration with structured outputs and auto-execution, and (4) frontend state management for real-time SSE-driven prices alongside API-driven portfolio state.

This document prescribes the specific patterns to use, grounded in current (2026) best practices and verified with official documentation.

---

## FastAPI App Structure

### Recommended Pattern: Lifespan Context Manager

**Why:** FastAPI 0.95+ recommends the `lifespan` parameter with async context managers over the older `@app.on_event()` decorators. This colocates startup and shutdown logic, ensuring resources acquired on startup are precisely released on shutdown.

### Module Layout

```
backend/
├── app/
│   ├── __init__.py                 # FastAPI app factory
│   ├── lifespan.py                 # Lifespan context manager
│   ├── dependencies.py             # Dependency injection helpers
│   ├── market/                     # Existing market data (simulator, cache, SSE)
│   ├── db/
│   │   ├── __init__.py
│   │   ├── schema.py               # SQL schema definitions
│   │   ├── models.py               # SQLAlchemy ORM (or dataclasses)
│   │   └── migrations.py           # Lazy init logic
│   ├── portfolio/
│   │   ├── __init__.py
│   │   ├── routes.py               # POST /api/portfolio/trade, GET /api/portfolio
│   │   ├── service.py              # Trade execution logic, validation
│   │   └── models.py               # Pydantic schemas for requests/responses
│   ├── watchlist/
│   │   ├── __init__.py
│   │   ├── routes.py               # GET/POST/DELETE /api/watchlist/*
│   │   └── service.py              # Watchlist operations
│   ├── chat/
│   │   ├── __init__.py
│   │   ├── routes.py               # POST /api/chat
│   │   ├── service.py              # LLM prompt construction, structured output parsing
│   │   ├── models.py               # Pydantic schemas (ChatRequest, ChatResponse, etc.)
│   │   └── llm_client.py           # LiteLLM wrapper
│   └── main.py                     # Entry point; uvicorn target
├── tests/
├── pyproject.toml
└── uv.lock
```

### Implementation Pattern: Lifespan

```python
# app/lifespan.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from .market import PriceCache, create_market_data_source
from .db import init_db, get_db
import logging

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app lifecycle: startup, request handling, shutdown."""
    # Startup
    logger.info("Application startup...")
    
    price_cache = PriceCache()
    db = init_db()  # Lazy-initializes SQLite, creates schema if needed
    
    source = create_market_data_source(price_cache)
    
    # Load default watchlist tickers from database
    watchlist = db.query("SELECT ticker FROM watchlist WHERE user_id='default'")
    tickers = [row['ticker'] for row in watchlist]
    
    # Start market data background task
    await source.start(tickers)
    
    # Attach to app.state for access in routes (dependency injection)
    app.state.price_cache = price_cache
    app.state.db = db
    app.state.market_source = source
    
    # Start portfolio snapshot background task
    background_task = asyncio.create_task(
        portfolio_snapshot_loop(db, price_cache)
    )
    app.state.snapshot_task = background_task
    
    logger.info("Application startup complete")
    yield  # Application runs here
    
    # Shutdown
    logger.info("Application shutdown...")
    try:
        await source.stop()
        background_task.cancel()
        db.close()
    except Exception as e:
        logger.error(f"Shutdown error: {e}")
    logger.info("Application shutdown complete")

# app/main.py
from fastapi import FastAPI
from .lifespan import lifespan
from .market import create_stream_router
from .portfolio import create_portfolio_router
from .watchlist import create_watchlist_router
from .chat import create_chat_router

app = FastAPI(lifespan=lifespan)

# Routers are created in a factory pattern; they receive dependencies
# via the route factory functions, not directly from app.state
# (This allows testing without a full app instance)

app.include_router(create_stream_router(None))  # Price cache injected at runtime
app.include_router(create_portfolio_router(None, None))  # Cache, DB injected
# ... etc

@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

### Dependency Injection for Routes

Do **not** use `app.state` directly in route handlers. Instead, use route factory functions that receive dependencies:

```python
# app/portfolio/routes.py
from fastapi import APIRouter, Depends
from ..dependencies import get_db, get_price_cache

def create_portfolio_router(price_cache, db) -> APIRouter:
    router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])
    
    @router.get("")
    async def get_portfolio(
        cache: PriceCache = Depends(get_price_cache),
        database = Depends(get_db),
    ):
        # Implementation
        pass
    
    return router

# app/dependencies.py
from fastapi import Request

def get_price_cache(request: Request):
    return request.app.state.price_cache

def get_db(request: Request):
    return request.app.state.db
```

**Rationale:** This pattern enables:
1. Testing routes without a full app instance
2. Mocking dependencies in tests
3. Clear dependency graphs visible in route signatures

---

## Database Layer

### SQLite: sqlite3 vs aiosqlite

**Recommendation: Use `sqlite3` directly (not aiosqlite) for trade execution and data queries.**

**Why:**
- **SQLite is synchronous by design.** It uses file-level locking, not connection pools. There is no performance benefit to async I/O; the bottleneck is the database lock, not I/O.
- **Write contention is the constraint.** In FinAlly's single-user model, only one trade happens at a time, so synchronous access is fine.
- **Simpler code.** No need for connection pools or async/await for database operations.
- **Trade execution must be atomic.** Synchronous transactions are easier to reason about.

**When to use aiosqlite:**
- If you add real-time WebSocket trading with multiple concurrent users
- If you need to stream large result sets without blocking

For now, **use `sqlite3` in a background thread per request** (FastAPI's `run_in_threadpool`) to avoid blocking the event loop.

### Connection Pattern

```python
# app/db/__init__.py
import sqlite3
from pathlib import Path
import logging

DB_PATH = Path("db/finally.db")
logger = logging.getLogger(__name__)

def get_connection() -> sqlite3.Connection:
    """Get a database connection with sensible defaults."""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    conn.execute("PRAGMA journal_mode=WAL")  # Write-Ahead Logging for concurrency
    conn.execute("PRAGMA synchronous=NORMAL")  # Balance safety and speed
    conn.execute("PRAGMA foreign_keys=ON")  # Enforce foreign key constraints
    return conn

def init_db() -> sqlite3.Connection:
    """Create database and schema if not present."""
    conn = get_connection()
    schema = Path(__file__).parent / "schema.sql"
    
    if schema.exists():
        cursor = conn.cursor()
        cursor.executescript(schema.read_text())
        conn.commit()
    
    # Seed default data if needed
    seed_data(conn)
    
    return conn

def seed_data(conn: sqlite3.Connection):
    """Insert default user, watchlist, and portfolio snapshots."""
    cursor = conn.cursor()
    
    # Check if default user exists
    cursor.execute("SELECT id FROM users_profile WHERE id='default'")
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, datetime('now'))",
            ("default", 10000.0)
        )
    
    # Seed default watchlist (only if empty)
    cursor.execute("SELECT COUNT(*) FROM watchlist WHERE user_id='default'")
    if cursor.fetchone()[0] == 0:
        default_tickers = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]
        for ticker in default_tickers:
            cursor.execute(
                "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, datetime('now'))",
                (str(uuid.uuid4()), "default", ticker)
            )
    
    conn.commit()
```

### Using the Database in Routes

Since `sqlite3` blocks, wrap synchronous database calls in `run_in_threadpool`:

```python
# app/portfolio/routes.py
from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
from ..dependencies import get_db

@router.get("/portfolio")
async def get_portfolio(db = Depends(get_db)):
    """Fetch portfolio state: cash, positions, total value, P&L."""
    
    # Run sync database query in thread pool to avoid blocking event loop
    def _get_state():
        cursor = db.cursor()
        
        # Fetch user profile
        cursor.execute("SELECT * FROM users_profile WHERE id='default'")
        profile = cursor.fetchone()
        
        # Fetch positions with current prices
        cursor.execute("""
            SELECT ticker, quantity, avg_cost FROM positions
            WHERE user_id='default' AND quantity > 0
        """)
        positions = cursor.fetchall()
        
        return {"profile": profile, "positions": positions}
    
    state = await run_in_threadpool(_get_state)
    # ... compute P&L, format response
```

---

## Trade Execution Flow

### Atomic Trade Validation & Execution

**Requirement:** A trade must be atomically validated and executed. No race conditions between validation and execution.

**Pattern:** SQLite transactions + single explicit COMMIT

```python
# app/portfolio/service.py
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool

async def execute_trade(
    db: sqlite3.Connection,
    ticker: str,
    side: str,  # "buy" or "sell"
    quantity: float,
    price_cache: PriceCache,
) -> dict:
    """Execute a trade: validate, update positions, record trade, snapshot portfolio."""
    
    def _execute_sync():
        # Fetch current price from cache (outside DB transaction for freshness)
        current_price = price_cache.get_price(ticker)
        if current_price is None:
            raise HTTPException(400, f"No price for {ticker}")
        
        cursor = db.cursor()
        
        try:
            # Begin transaction
            cursor.execute("BEGIN IMMEDIATE")  # IMMEDIATE to acquire write lock early
            
            # 1. Fetch current state
            cursor.execute(
                "SELECT cash_balance FROM users_profile WHERE id='default'"
            )
            profile = cursor.fetchone()
            if not profile:
                raise HTTPException(500, "User profile not found")
            cash_balance = profile["cash_balance"]
            
            cursor.execute(
                "SELECT quantity, avg_cost FROM positions WHERE user_id='default' AND ticker=?",
                (ticker,)
            )
            position = cursor.fetchone()
            current_qty = position["quantity"] if position else 0
            
            # 2. Validate
            if side == "buy":
                cost = quantity * current_price
                if cost > cash_balance:
                    raise HTTPException(400, f"Insufficient cash: need {cost}, have {cash_balance}")
            elif side == "sell":
                if quantity > current_qty:
                    raise HTTPException(400, f"Insufficient shares: trying to sell {quantity}, have {current_qty}")
            else:
                raise HTTPException(400, f"Invalid side: {side}")
            
            # 3. Execute
            if side == "buy":
                # Update cash
                new_cash = cash_balance - (quantity * current_price)
                cursor.execute(
                    "UPDATE users_profile SET cash_balance=? WHERE id='default'",
                    (new_cash,)
                )
                
                # Update position (upsert)
                if current_qty > 0:
                    # Recompute average cost
                    new_avg_cost = (
                        (current_qty * position["avg_cost"] + quantity * current_price) /
                        (current_qty + quantity)
                    )
                    cursor.execute(
                        "UPDATE positions SET quantity=?, avg_cost=?, updated_at=datetime('now') WHERE user_id='default' AND ticker=?",
                        (current_qty + quantity, new_avg_cost, ticker)
                    )
                else:
                    # New position
                    cursor.execute(
                        "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
                        (str(uuid.uuid4()), "default", ticker, quantity, current_price)
                    )
            
            elif side == "sell":
                # Update cash
                new_cash = cash_balance + (quantity * current_price)
                cursor.execute(
                    "UPDATE users_profile SET cash_balance=? WHERE id='default'",
                    (new_cash,)
                )
                
                # Update position
                new_qty = current_qty - quantity
                if new_qty > 0:
                    cursor.execute(
                        "UPDATE positions SET quantity=?, updated_at=datetime('now') WHERE user_id='default' AND ticker=?",
                        (new_qty, ticker)
                    )
                else:
                    # Delete position if quantity drops to 0
                    cursor.execute(
                        "DELETE FROM positions WHERE user_id='default' AND ticker=?",
                        (ticker,)
                    )
            
            # 4. Append to trade log (immutable audit trail)
            cursor.execute(
                "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
                (str(uuid.uuid4()), "default", ticker, side, quantity, current_price)
            )
            
            # 5. Record portfolio snapshot
            total_value = compute_portfolio_value(cursor, price_cache)
            cursor.execute(
                "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) VALUES (?, ?, ?, datetime('now'))",
                (str(uuid.uuid4()), "default", total_value)
            )
            
            # 6. Commit
            db.commit()
            
            # Return updated state
            return {
                "success": True,
                "ticker": ticker,
                "side": side,
                "quantity": quantity,
                "price": current_price,
                "new_balance": new_cash if side == "buy" else new_cash,
                "timestamp": datetime.now().isoformat(),
            }
        
        except Exception as e:
            db.rollback()
            raise
    
    return await run_in_threadpool(_execute_sync)
```

**Key Points:**
1. **`BEGIN IMMEDIATE`** — Acquires write lock immediately, preventing phantom reads
2. **Fetch price from cache** (not DB) — Market data is single-threaded, cache is thread-safe
3. **Validate before executing** — Clear separation of validation and mutation
4. **Atomic COMMIT** — All-or-nothing semantics guaranteed by SQLite
5. **Append to trades table** — Immutable audit log, never update or delete
6. **Snapshot portfolio immediately** — For accurate P&L chart at trade time

---

## LLM Integration Architecture

### Structured Output Schema

Use Pydantic v2 to define the LLM response schema. The schema will be exported to JSON Schema for OpenRouter/Cerebras.

```python
# app/chat/models.py
from pydantic import BaseModel, Field
from typing import Optional

class TradeAction(BaseModel):
    """A single trade to execute."""
    ticker: str = Field(..., description="Ticker symbol, e.g., 'AAPL'")
    side: str = Field(..., description="'buy' or 'sell'")
    quantity: float = Field(..., description="Number of shares (supports fractional)")

class WatchlistAction(BaseModel):
    """A watchlist change to apply."""
    ticker: str = Field(..., description="Ticker symbol, e.g., 'PYPL'")
    action: str = Field(..., description="'add' or 'remove'")

class ChatResponse(BaseModel):
    """Structured response from the LLM."""
    message: str = Field(..., description="Conversational response to the user")
    trades: Optional[list[TradeAction]] = Field(
        default=None,
        description="Trades to auto-execute"
    )
    watchlist_changes: Optional[list[WatchlistAction]] = Field(
        default=None,
        description="Watchlist changes to apply"
    )
```

### LiteLLM Wrapper

```python
# app/chat/llm_client.py
from litellm import completion
from typing import Optional
import json
import logging
import os

logger = logging.getLogger(__name__)

class LLMClient:
    def __init__(self):
        self.api_key = os.environ.get("OPENROUTER_API_KEY")
        self.mock_mode = os.environ.get("LLM_MOCK", "").lower() == "true"
    
    async def chat(
        self,
        system_prompt: str,
        messages: list[dict],
        response_schema: dict,  # JSON schema from ChatResponse.model_json_schema()
    ) -> ChatResponse:
        """Call LLM with structured output, return parsed response."""
        
        if self.mock_mode:
            logger.info("LLM_MOCK=true: returning deterministic mock response")
            return ChatResponse(
                message="Mock response. Your portfolio looks good!",
                trades=[],
                watchlist_changes=[]
            )
        
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        
        try:
            # Use LiteLLM to call OpenRouter
            # The model string format: "openrouter/openai/gpt-oss-120b"
            # (Note: NOT "openrouter/free" — that causes 502 errors; use "openai/gpt-oss-120b" with openrouter prefix)
            
            response = await completion(
                model="openrouter/openai/gpt-oss-120b",
                messages=full_messages,
                api_key=self.api_key,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "ChatResponse",
                        "schema": response_schema,
                    }
                },
                temperature=0.7,
                max_tokens=1000,
                timeout=30,
            )
            
            # Extract JSON from response
            content = response.choices[0].message.content
            parsed = json.loads(content)
            
            return ChatResponse(**parsed)
        
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            # Graceful degradation: return empty response
            return ChatResponse(
                message=f"I encountered an error: {str(e)}. Please try again.",
                trades=[],
                watchlist_changes=[]
            )
```

### Chat Service: Prompt Construction & Execution

```python
# app/chat/service.py
from datetime import datetime
from fastapi.concurrency import run_in_threadpool
import uuid

async def handle_chat_message(
    db,
    price_cache: PriceCache,
    llm_client: LLMClient,
    user_message: str,
) -> dict:
    """Process a user message: construct context, call LLM, auto-execute trades."""
    
    def _get_context():
        """Fetch portfolio context from database and price cache."""
        cursor = db.cursor()
        
        # User profile
        cursor.execute("SELECT cash_balance FROM users_profile WHERE id='default'")
        profile = cursor.fetchone()
        cash = profile["cash_balance"] if profile else 0
        
        # Positions
        cursor.execute("""
            SELECT ticker, quantity, avg_cost FROM positions
            WHERE user_id='default' AND quantity > 0
        """)
        positions_rows = cursor.fetchall()
        
        positions = []
        total_stock_value = 0
        for row in positions_rows:
            ticker = row["ticker"]
            qty = row["quantity"]
            avg_cost = row["avg_cost"]
            current_price = price_cache.get_price(ticker) or 0
            unrealized_pnl = (current_price - avg_cost) * qty
            total_stock_value += current_price * qty
            
            positions.append({
                "ticker": ticker,
                "quantity": qty,
                "avg_cost": avg_cost,
                "current_price": current_price,
                "unrealized_pnl": round(unrealized_pnl, 2),
            })
        
        # Watchlist
        cursor.execute("""
            SELECT ticker FROM watchlist WHERE user_id='default'
        """)
        watchlist = [row["ticker"] for row in cursor.fetchall()]
        
        total_value = cash + total_stock_value
        
        return {
            "cash": round(cash, 2),
            "positions": positions,
            "total_value": round(total_value, 2),
            "watchlist": watchlist,
        }
    
    context = await run_in_threadpool(_get_context)
    
    # Build system prompt
    system_prompt = f"""You are FinAlly, an AI trading assistant for a simulated trading portfolio.

Current Portfolio State:
- Cash Balance: ${context['cash']}
- Positions: {json.dumps(context['positions'], indent=2)}
- Total Portfolio Value: ${context['total_value']}
- Watched Tickers: {', '.join(context['watchlist'])}

Your role:
- Analyze portfolio composition and P&L
- Suggest trades with reasoning
- Execute trades when the user asks
- Manage the watchlist
- Be concise and data-driven

Always respond with valid JSON matching the ChatResponse schema.
"""

    # Load recent conversation history
    def _get_history():
        cursor = db.cursor()
        cursor.execute("""
            SELECT role, content FROM chat_messages
            WHERE user_id='default'
            ORDER BY created_at DESC
            LIMIT 10
        """)
        history = []
        for row in reversed(cursor.fetchall()):
            # Only include the message text, not actions
            history.append({"role": row["role"], "content": row["content"]})
        return history
    
    history = await run_in_threadpool(_get_history)
    
    # Add current user message
    messages = history + [{"role": "user", "content": user_message}]
    
    # Call LLM
    response = await llm_client.chat(
        system_prompt=system_prompt,
        messages=messages,
        response_schema=ChatResponse.model_json_schema(),
    )
    
    # Auto-execute trades
    executed_trades = []
    if response.trades:
        for trade in response.trades:
            try:
                result = await execute_trade(
                    db,
                    trade.ticker,
                    trade.side,
                    trade.quantity,
                    price_cache
                )
                executed_trades.append(result)
            except Exception as e:
                logger.error(f"Trade execution failed: {e}")
                # Include error in response; continue with other trades
    
    # Apply watchlist changes
    executed_watchlist = []
    if response.watchlist_changes:
        for change in response.watchlist_changes:
            try:
                if change.action == "add":
                    # Add to watchlist and start tracking in market data source
                    await add_watchlist_ticker(db, change.ticker)
                    executed_watchlist.append({"ticker": change.ticker, "action": "add"})
                elif change.action == "remove":
                    await remove_watchlist_ticker(db, change.ticker)
                    executed_watchlist.append({"ticker": change.ticker, "action": "remove"})
            except Exception as e:
                logger.error(f"Watchlist change failed: {e}")
    
    # Store message + actions in chat_messages table
    def _store_message():
        cursor = db.cursor()
        cursor.execute("""
            INSERT INTO chat_messages (id, user_id, role, content, actions, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        """, (
            str(uuid.uuid4()),
            "default",
            "user",
            user_message,
            None,  # User messages don't have actions
        ))
        
        # Store assistant response
        actions = {
            "trades": executed_trades,
            "watchlist_changes": executed_watchlist,
        }
        cursor.execute("""
            INSERT INTO chat_messages (id, user_id, role, content, actions, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        """, (
            str(uuid.uuid4()),
            "default",
            "assistant",
            response.message,
            json.dumps(actions) if actions else None,
        ))
        db.commit()
    
    await run_in_threadpool(_store_message)
    
    return {
        "message": response.message,
        "trades": executed_trades,
        "watchlist_changes": executed_watchlist,
    }
```

---

## Frontend State Management

### Architecture: Zustand + TanStack Query + EventSource

**Pattern (2026 best practice):**
- **Zustand** for client-only UI state (chat panel open/closed, selected ticker, form inputs)
- **TanStack Query** for server state (portfolio positions, watchlist, chat history) — handles caching, refetch, background sync
- **EventSource** (native browser API) for SSE price stream → direct store to in-memory price cache (lightweight, no external dependency)

**Why NOT Context API or Redux:** Too verbose for this use case. Zustand's minimal API + TanStack Query's caching eliminates the need for complex state trees.

### Price Cache (Frontend)

Store SSE prices in a simple Zustand store (not TanStack Query, since prices arrive every 500ms and don't persist to the server):

```typescript
// frontend/src/stores/priceStore.ts
import { create } from 'zustand';

interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  timestamp: number;
  change: number;
  change_percent: number;
  direction: 'up' | 'down' | 'flat';
}

interface PriceStore {
  prices: Record<string, PriceUpdate>;
  connected: boolean;
  
  updatePrice: (ticker: string, update: PriceUpdate) => void;
  setConnected: (connected: boolean) => void;
  getPrice: (ticker: string) => number | null;
}

export const usePriceStore = create<PriceStore>((set, get) => ({
  prices: {},
  connected: false,
  
  updatePrice: (ticker, update) => 
    set(state => ({
      prices: { ...state.prices, [ticker]: update }
    })),
  
  setConnected: (connected) => set({ connected }),
  
  getPrice: (ticker) => {
    const update = get().prices[ticker];
    return update ? update.price : null;
  },
}));
```

### SSE Connection (Frontend)

Connect to `/api/stream/prices` on mount, push updates to price store:

```typescript
// frontend/src/hooks/useSSE.ts
import { useEffect } from 'react';
import { usePriceStore } from '@/stores/priceStore';

export function useSSE() {
  const { updatePrice, setConnected } = usePriceStore();
  
  useEffect(() => {
    const eventSource = new EventSource('/api/stream/prices');
    
    eventSource.onopen = () => {
      setConnected(true);
      console.log('SSE connected');
    };
    
    eventSource.onmessage = (event) => {
      try {
        const priceData = JSON.parse(event.data);
        for (const [ticker, update] of Object.entries(priceData)) {
          updatePrice(ticker, update as PriceUpdate);
        }
      } catch (e) {
        console.error('Failed to parse SSE data:', e);
      }
    };
    
    eventSource.onerror = () => {
      setConnected(false);
      console.log('SSE disconnected; browser will auto-reconnect');
      // EventSource.readyState will be CONNECTING; auto-reconnect happens after 1s
    };
    
    return () => {
      eventSource.close();
    };
  }, [updatePrice, setConnected]);
}
```

### Portfolio State (TanStack Query)

Use TanStack Query for server state (portfolio, watchlist, chat history):

```typescript
// frontend/src/hooks/usePortfolio.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const res = await fetch('/api/portfolio');
      return res.json();
    },
    refetchInterval: 5000, // Refetch every 5s for updated P&L
  });
}

export function useExecuteTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (trade: { ticker: string; side: string; quantity: number }) => {
      const res = await fetch('/api/portfolio/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trade),
      });
      return res.json();
    },
    onSuccess: () => {
      // Refetch portfolio after trade
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}
```

### UI State (Zustand)

```typescript
// frontend/src/stores/uiStore.ts
import { create } from 'zustand';

interface UIStore {
  selectedTicker: string | null;
  chatOpen: boolean;
  loading: boolean;
  
  selectTicker: (ticker: string | null) => void;
  toggleChat: () => void;
  setLoading: (loading: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  selectedTicker: null,
  chatOpen: false,
  loading: false,
  
  selectTicker: (ticker) => set({ selectedTicker: ticker }),
  toggleChat: () => set(state => ({ chatOpen: !state.chatOpen })),
  setLoading: (loading) => set({ loading }),
}));
```

### Putting It Together

```typescript
// frontend/src/pages/index.tsx
import { useSSE } from '@/hooks/useSSE';
import { usePortfolio } from '@/hooks/usePortfolio';
import { usePriceStore } from '@/stores/priceStore';

export default function Home() {
  // Start SSE connection
  useSSE();
  
  // Fetch server state
  const { data: portfolio, isLoading } = usePortfolio();
  
  // Access price cache
  const prices = usePriceStore(state => state.prices);
  const connected = usePriceStore(state => state.connected);
  
  return (
    <div>
      {/* Price flash happens via CSS class toggling on PriceUpdate.direction */}
      {/* Component receives prices from Zustand store */}
      <Watchlist prices={prices} />
      
      {/* Portfolio treemap colors based on P&L from portfolio query */}
      {portfolio && <PortfolioHeatmap portfolio={portfolio} />}
      
      {/* Connection status indicator */}
      <ConnectionDot connected={connected} />
    </div>
  );
}
```

**EventSource Reconnection (Built-in):**
- Browser's `EventSource` automatically reconnects on disconnect
- Server sets `retry: 1000` to wait 1 second between attempts
- No need for manual reconnection logic or libraries like `reconnecting-eventsource`

---

## Recommended Build Order

### Phase 1: Database & Core API (2-3 days)

**Goal:** Persistence + basic CRUD

**Tasks:**
1. `app/db/schema.sql` — Define all tables (users_profile, positions, trades, portfolio_snapshots, watchlist, chat_messages)
2. `app/db/__init__.py` — Lazy init, seed data, PRAGMA settings
3. `app/lifespan.py` — FastAPI lifespan context manager
4. `app/main.py` — FastAPI app factory with lifespan
5. `app/portfolio/routes.py` + `service.py` — GET /api/portfolio, POST /api/portfolio/trade
6. `app/watchlist/routes.py` — GET/POST/DELETE /api/watchlist/*
7. Tests: Trade execution validation, position updates, atomic rollback

**Why first:** Everything else depends on reliable persistence. Trade execution is the core business logic.

### Phase 2: LLM Integration (1-2 days)

**Goal:** Chat endpoint with structured outputs, auto-execution

**Tasks:**
1. `app/chat/models.py` — Pydantic schemas (ChatResponse, TradeAction, WatchlistAction)
2. `app/chat/llm_client.py` — LiteLLM wrapper, structured output schema, mock mode
3. `app/chat/service.py` — Prompt construction, context injection, trade auto-execution
4. `app/chat/routes.py` — POST /api/chat endpoint
5. Tests: LLM response parsing, trade validation in auto-execution, mock mode

**Why second:** Depends on database and trade execution. Can run in parallel with Phase 3 if resources allow.

### Phase 3: Frontend (3-4 days)

**Goal:** Full UI with real-time prices, trading, chat

**Tasks:**
1. `frontend/src/stores/priceStore.ts` — Zustand price cache
2. `frontend/src/stores/uiStore.ts` — UI state (selected ticker, chat panel)
3. `frontend/src/hooks/useSSE.ts` — EventSource connection
4. `frontend/src/hooks/usePortfolio.ts` — TanStack Query for server state
5. Components:
   - Watchlist (grid/table with prices, flash animation, sparklines)
   - Chart (larger price chart for selected ticker)
   - Positions table (ticker, qty, avg cost, current price, P&L)
   - Trade bar (ticker input, quantity input, buy/sell buttons)
   - Portfolio heatmap/treemap
   - P&L chart (portfolio value over time)
   - Chat panel (message history, input, loading indicator)
   - Header (portfolio value, cash balance, connection dot)
6. Styling: Tailwind CSS, dark theme, price flash animations (CSS transitions)

**Why third:** UI is independent of LLM; users can trade manually while LLM is being built.

### Phase 4: Docker & E2E Tests (1-2 days)

**Goal:** Single container, full app delivery, validated flows

**Tasks:**
1. Multi-stage Dockerfile (Node build → Python runtime)
2. Docker volume mount for SQLite persistence
3. start/stop scripts (macOS/Linux shell, Windows PowerShell)
4. E2E tests (Playwright, docker-compose.test.yml):
   - Fresh start: default watchlist loads, prices stream
   - Buy/sell: portfolio updates
   - Chat: LLM response (mocked), trades execute
   - SSE resilience: disconnect/reconnect
5. Integration tests: market data → SSE → frontend price updates

**Why fourth:** Depends on all previous phases; final integration step.

### Phase 5: Polish & Stretch Goals (as time allows)

- Real-time WebSocket chat (if SSE feels too slow; unlikely at scale)
- More chart libraries (Lightweight Charts, Recharts for advanced analytics)
- Keyboard shortcuts (1 key = buy, 2 = sell, etc.)
- Persistent chat history pagination
- Portfolio export (CSV, JSON)
- Cloud deployment (Terraform for AWS App Runner)

---

## Key Design Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|-----------|
| **Lifespan context manager** | Colocates startup/shutdown; modern FastAPI pattern (0.95+) | Slightly more boilerplate than `@app.on_event()` |
| **sqlite3 (not aiosqlite)** | SQLite is file-locked, not I/O-bound; sync simpler for atomic trades | Can't handle thousands of concurrent connections (but single-user OK) |
| **BEGIN IMMEDIATE** | Acquires write lock early, preventing phantom reads in trade validation | Slightly higher latency than DEFERRED, but safer for critical ops |
| **Zustand + TanStack Query** | Minimal boilerplate, clear separation of client/server state | Requires learning two libraries instead of one monolithic store |
| **EventSource (no reconnecting-eventsource)** | Native browser API with built-in reconnect; no library overhead | No POST support (not needed for prices); limited to text/event-stream |
| **Pydantic for LLM schema** | Single source of truth; json_schema export for OpenRouter; 3.5x faster validation | Requires Pydantic v2; schema customization via Field() |
| **Trade auto-execution by LLM** | Zero-cost sandbox + impressive demo | Potential for user confusion (mitigated by clear chat messages) |

---

## Verification Sources

- [FastAPI Lifespan Events](https://fastapi.tiangolo.com/advanced/events/)
- [How to Use Async Database Connections in FastAPI](https://oneuptime.com/blog/post/2026-02-02-fastapi-async-database/view)
- [Mastering Transaction Handling in SQLite with Python](https://en.ittrip.xyz/python/sqlite-transactions-python)
- [Pydantic v2 JSON Schema](https://docs.pydantic.dev/latest/concepts/json_schema/)
- [React State Management 2026: Zustand Best Practices](https://viprasol.com/blog/state-management-react-2026/)
- [OpenRouter Structured Outputs](https://openrouter.ai/docs/guides/features/structured-outputs)
- [Using Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [LiteLLM Structured Outputs](https://docs.litellm.ai/docs/completion/json_mode)

---

**Architecture analysis: 2026-04-09 | Ready for implementation**
