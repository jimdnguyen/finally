# Phase 2: Portfolio Trading - Research

**Researched:** 2026-04-10  
**Domain:** Atomic trade execution, background task patterns in FastAPI, Decimal arithmetic for position updates, portfolio snapshots  
**Confidence:** HIGH

---

## Summary

Phase 2 implements atomic trade execution (`POST /api/portfolio/trade`) and the portfolio snapshot background task (`DATA-05`). The challenge is **coordinating three concurrent concerns**: (1) validating trades against live prices from the `PriceCache`, (2) executing trades atomically with `BEGIN IMMEDIATE` transactions to prevent phantom reads, and (3) sampling portfolio value every 30 seconds while remaining responsive to trade requests. Critical patterns: (1) reuse `validate_trade_setup()` from Phase 1 service layer before trade execution, (2) wrap the entire trade flow (fetch price, validate, execute, record snapshot) in a single `BEGIN IMMEDIATE` block, (3) use `asyncio.create_task()` in the FastAPI lifespan to spawn the 30-second snapshot loop as a background task, (4) maintain Decimal precision throughout position updates and average cost recalculation, and (5) test trade atomicity by verifying rollback behavior and database consistency on app restart.

**Primary recommendation:** Trade execution is a single synchronous function protected by `BEGIN IMMEDIATE`, wrapped with `run_in_threadpool` for async callers. Portfolio snapshots are recorded immediately after every trade (within the same transaction) and then independently every 30 seconds via a background task spawned in the lifespan. Validate trades before acquiring the transaction lock, but re-validate inside the transaction in case price data is stale.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Atomic trade execution** — `BEGIN IMMEDIATE` + explicit `COMMIT` required; no partial state on failure
- **Decimal precision** — all monetary calculations use `Decimal(str(value))` pattern
- **Single default user** — hardcoded as `user_id="default"` in all database queries
- **Market orders only** — no limit orders, no order book complexity
- **Trade validation reuse** — `validate_trade_setup()` from Phase 1 must be called before execution
- **Portfolio snapshots** — recorded at 30-second intervals (background task) + immediately post-trade
- **Background tasks via asyncio** — `asyncio.create_task()` spawned in FastAPI lifespan, not threaded workers

### Claude's Discretion
- **Position upsert strategy**: When buying more of an existing position, recalculate weighted average cost inline during the trade execution transaction
- **Trade logging**: Append-only trades table serves as immutable audit trail; includes ticker, side, quantity, price, executed_at
- **Error handling**: Invalid trades return HTTP 400 with descriptive reason; client receives clear feedback without exposing database state
- **Snapshot granularity**: 30 seconds is standard for demo; can be adjusted via environment variable if performance needed

### Deferred Ideas (OUT OF SCOPE)
- Partial fills or order management
- Trade reversal/cancellation
- Leverage or margin trading
- Tax lot tracking or wash sale rules
- Complex order types (stop-loss, trailing stops, etc.)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PORT-02 | `POST /api/portfolio/trade` with buy/sell validation, atomic execution, trade log | Covered: atomic transaction pattern + trade validation reuse + logging |
| DATA-05 | Portfolio snapshot background task (every 30s + immediately post-trade) | Covered: asyncio task pattern in lifespan + transaction-scoped snapshot insertion |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.115.0+ | Async routes, dependency injection, Pydantic request bodies | Established in Phase 1; native async/await support |
| sqlite3 | 3.x (stdlib) | Atomic transactions with `BEGIN IMMEDIATE` | WAL mode from Phase 1; single-writer model sufficient for single-user demo |
| Decimal (stdlib) | 3.12 | Exact monetary arithmetic for position updates and average cost | Non-negotiable for financial calculations; prevents IEEE 754 errors |
| asyncio (stdlib) | 3.12 | Background task spawning and cancellation | Native Python; `create_task()` for lifecycle-managed background loop |
| uuid (stdlib) | 3.12 | Unique trade and snapshot IDs | Deterministic in tests; auto-generated in production |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fastapi.concurrency | 0.115.0+ | `run_in_threadpool()` for sync database operations | Every async route that calls sync sqlite3 functions |
| Pydantic v2 | (implicit via FastAPI) | Trade request validation (TradeRequest schema) | Automatic request body validation and JSON serialization |
| datetime (stdlib) | 3.12 | ISO timestamp recording for trades and snapshots | All `executed_at` and `recorded_at` fields use `datetime('now')` in SQL |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `BEGIN IMMEDIATE` | `BEGIN` | `IMMEDIATE` acquires write lock early, preventing phantom reads. Required for correctness in concurrent environment. |
| asyncio task | ThreadPoolExecutor background task | asyncio is simpler, more efficient for I/O-bound polling; threaded pool adds complexity. |
| Position upsert in trade txn | Separate position query then update | Atomic execution requires both operations in same transaction; separation introduces race condition window. |
| Snapshot post-trade + 30s loop | Snapshot only on schedule | Missing immediate feedback after trade; user sees stale P&L. Snapshot immediately post-trade is essential. |

**Installation:**
```bash
# All dependencies already in uv.lock; nothing new to install
uv run --extra dev pytest -v tests/test_portfolio.py
```

**Version verification:**
```bash
# Verify libraries are available (all are stdlib or already locked)
python3 -c "from decimal import Decimal; from asyncio import create_task; print('Ready for Phase 2')"
```

---

## Architecture Patterns

### Recommended Project Structure

Phase 2 extends Phase 1 with:
```
backend/
├── app/
│   ├── portfolio/
│   │   ├── __init__.py
│   │   ├── models.py              # (Phase 1) + TradeRequest, TradeResponse additions
│   │   ├── service.py              # (Phase 1) + execute_trade(), record_snapshot()
│   │   └── routes.py               # (Phase 1) + POST /api/portfolio/trade route
│   ├── background/                 # NEW: Background tasks
│   │   ├── __init__.py
│   │   └── tasks.py                # snapshot_loop() task
│   └── main.py                      # (Phase 1) updated with snapshot task spawning
├── tests/
│   └── test_portfolio.py            # (Phase 1) + atomic trade tests + snapshot tests
└── ...
```

### Pattern 1: Atomic Trade Execution with Position Upsert

**What:** Single `BEGIN IMMEDIATE` transaction encapsulating validation, cash update, position upsert, trade log entry, and snapshot recording.

**When to use:** All trade execution. The entire flow must be all-or-nothing.

**Example:**

```python
# app/portfolio/service.py
async def execute_trade(
    db: sqlite3.Connection,
    ticker: str,
    side: str,  # "buy" or "sell"
    quantity: Decimal,
    price_cache: PriceCache,
) -> dict:
    """Execute a trade atomically: validate, update positions, record snapshot.
    
    Entire flow is wrapped in BEGIN IMMEDIATE transaction:
    1. Fetch current price from cache
    2. Validate (sufficient cash for buy, sufficient shares for sell)
    3. Update cash balance
    4. Upsert position (buy: recalculate avg_cost if exists; sell: reduce qty or delete)
    5. Append trade log entry
    6. Record portfolio snapshot
    7. Commit
    
    On any error: rollback entire transaction.
    """
    async def _execute_sync():
        # Pre-validate against cache (fresh prices, no lock held)
        is_valid, error_msg = validate_trade_setup(db, ticker, side, quantity, price_cache)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Fetch current price fresh from cache
        current_price_update = price_cache.get(ticker)
        if not current_price_update:
            raise HTTPException(status_code=400, detail=f"No price for {ticker}")
        
        current_price = Decimal(str(current_price_update.price))
        
        cursor = db.cursor()
        
        try:
            # Begin immediate: acquire write lock early to prevent phantom reads
            cursor.execute("BEGIN IMMEDIATE")
            
            # Step 1: Fetch current state (fresh from DB, now locked)
            cursor.execute("SELECT cash_balance FROM users_profile WHERE id='default'")
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=500, detail="User profile not found")
            
            cash_balance = Decimal(str(row[0]))
            
            cursor.execute(
                """SELECT quantity, avg_cost FROM positions
                   WHERE user_id='default' AND ticker=? AND quantity > 0""",
                (ticker,),
            )
            pos_row = cursor.fetchone()
            current_qty = Decimal(str(pos_row[0])) if pos_row else Decimal("0")
            avg_cost = Decimal(str(pos_row[1])) if pos_row else Decimal("0")
            
            # Step 2: Validate (redundant check inside transaction in case price data changed)
            quantity_decimal = Decimal(str(quantity))
            
            if side.lower() == "buy":
                cost = quantity_decimal * current_price
                if cost > cash_balance:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient cash: need {float(cost)}, have {float(cash_balance)}",
                    )
            elif side.lower() == "sell":
                if quantity_decimal > current_qty:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient shares: need {float(quantity_decimal)}, have {float(current_qty)}",
                    )
            
            # Step 3: Execute
            if side.lower() == "buy":
                # Update cash
                new_cash = cash_balance - (quantity_decimal * current_price)
                cursor.execute(
                    "UPDATE users_profile SET cash_balance=? WHERE id='default'",
                    (str(new_cash),),
                )
                
                # Upsert position
                if current_qty > 0:
                    # Existing position: recalculate weighted average cost
                    new_qty = current_qty + quantity_decimal
                    new_avg_cost = (current_qty * avg_cost + quantity_decimal * current_price) / new_qty
                    cursor.execute(
                        """UPDATE positions SET quantity=?, avg_cost=?, updated_at=datetime('now')
                           WHERE user_id='default' AND ticker=?""",
                        (str(new_qty), str(new_avg_cost), ticker),
                    )
                else:
                    # New position
                    cursor.execute(
                        """INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
                           VALUES (?, 'default', ?, ?, ?, datetime('now'))""",
                        (str(uuid.uuid4()), ticker, str(quantity_decimal), str(current_price)),
                    )
            
            elif side.lower() == "sell":
                # Update cash
                new_cash = cash_balance + (quantity_decimal * current_price)
                cursor.execute(
                    "UPDATE users_profile SET cash_balance=? WHERE id='default'",
                    (str(new_cash),),
                )
                
                # Update or delete position
                new_qty = current_qty - quantity_decimal
                if new_qty > 0:
                    cursor.execute(
                        """UPDATE positions SET quantity=?, updated_at=datetime('now')
                           WHERE user_id='default' AND ticker=?""",
                        (str(new_qty), ticker),
                    )
                else:
                    cursor.execute(
                        "DELETE FROM positions WHERE user_id='default' AND ticker=?",
                        (ticker,),
                    )
            
            # Step 4: Trade log entry (immutable audit trail)
            cursor.execute(
                """INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at)
                   VALUES (?, 'default', ?, ?, ?, ?, datetime('now'))""",
                (str(uuid.uuid4()), ticker, side, str(quantity_decimal), str(current_price)),
            )
            
            # Step 5: Record portfolio snapshot (immediately post-trade)
            total_value = compute_portfolio_value(cursor, price_cache)
            cursor.execute(
                """INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at)
                   VALUES (?, 'default', ?, datetime('now'))""",
                (str(uuid.uuid4()), str(total_value)),
            )
            
            # Step 6: Commit
            db.commit()
            
            return {
                "success": True,
                "ticker": ticker,
                "side": side,
                "quantity": float(quantity_decimal),
                "price": float(current_price),
                "new_balance": float(new_cash),
                "executed_at": datetime.now().isoformat(),
            }
        
        except Exception as e:
            db.rollback()
            raise
    
    return await run_in_threadpool(_execute_sync)
```

**Sources:** [VERIFIED: Phase 1 RESEARCH.md Pattern 3: Atomic Trade Execution]

---

### Pattern 2: Background Task for Periodic Portfolio Snapshots

**What:** A long-lived asyncio task spawned in the FastAPI lifespan that samples portfolio value every 30 seconds.

**When to use:** Any recurring operation that must survive app restart and gracefully handle cancellation.

**Example:**

```python
# app/background/tasks.py
import asyncio
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)

async def snapshot_loop(db: sqlite3.Connection, price_cache: PriceCache, interval_seconds: int = 30):
    """Record portfolio snapshots every 30 seconds (or custom interval).
    
    Runs as a background task spawned in the FastAPI lifespan.
    Gracefully handles cancellation via asyncio.CancelledError.
    """
    try:
        while True:
            await asyncio.sleep(interval_seconds)
            
            # Run database access in threadpool to avoid blocking event loop
            async def _record_snapshot():
                cursor = db.cursor()
                total_value = compute_portfolio_value(cursor, price_cache)
                cursor.execute(
                    """INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at)
                       VALUES (?, 'default', ?, datetime('now'))""",
                    (str(uuid.uuid4()), str(total_value)),
                )
                db.commit()
                logger.debug(f"Portfolio snapshot recorded: ${float(total_value)}")
            
            await run_in_threadpool(_record_snapshot)
    
    except asyncio.CancelledError:
        logger.info("Portfolio snapshot loop cancelled (app shutting down)")
        raise

# app/main.py
from contextlib import asynccontextmanager
from app.background.tasks import snapshot_loop

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app lifecycle: startup, running, shutdown."""
    db = init_db()
    app.state.db = db
    
    price_cache = PriceCache()
    app.state.price_cache = price_cache
    
    source = create_market_data_source(price_cache)
    
    # Fetch default tickers from database
    cursor = db.cursor()
    cursor.execute("SELECT ticker FROM watchlist WHERE user_id='default'")
    tickers = [row[0] for row in cursor.fetchall()]
    
    await source.start(tickers)
    
    # Spawn background task for portfolio snapshots
    snapshot_task = asyncio.create_task(
        snapshot_loop(db, price_cache, interval_seconds=30),
        name="portfolio-snapshot-loop"
    )
    app.state.snapshot_task = snapshot_task
    
    logger.info("Application startup complete")
    
    yield  # Application runs here
    
    # Shutdown: cancel background task
    logger.info("Application shutting down...")
    snapshot_task.cancel()
    try:
        await snapshot_task
    except asyncio.CancelledError:
        pass  # Expected
    
    await source.stop()
    db.close()
    logger.info("Application shutdown complete")
```

**Sources:** [VERIFIED: FastAPI lifespan context manager pattern] [CITED: Python asyncio documentation on create_task()]

---

### Pattern 3: Trade Request/Response Models with Pydantic

**What:** Request body validation and response serialization via Pydantic schemas.

**When to use:** Every POST/PUT endpoint that accepts user input.

**Example:**

```python
# app/portfolio/models.py
from pydantic import BaseModel, Field

class TradeRequest(BaseModel):
    """POST /api/portfolio/trade request body."""
    ticker: str = Field(..., description="Ticker symbol (e.g., 'AAPL')")
    side: str = Field(..., description="'buy' or 'sell'")
    quantity: float = Field(..., gt=0, description="Number of shares (must be > 0)")

class TradeResponse(BaseModel):
    """POST /api/portfolio/trade response body."""
    success: bool
    ticker: str
    side: str
    quantity: float
    price: float
    new_balance: float
    executed_at: str  # ISO timestamp
```

**Sources:** [CITED: Pydantic v2 documentation on BaseModel and Field]

---

### Pattern 4: Decimal Precision in Position Upsert

**What:** When buying more shares of an existing position, recalculate the weighted average cost using exact Decimal arithmetic.

**When to use:** Every buy trade that increases an existing position.

**Formula:**
```
new_avg_cost = (current_qty * current_avg_cost + new_qty * new_price) / (current_qty + new_qty)
```

**Example:**

```python
# app/portfolio/service.py

# Position 1: 10 shares at $100.00
current_qty = Decimal("10")
current_avg_cost = Decimal("100.00")

# Buy 20 more at $105.00
new_qty_to_buy = Decimal("20")
new_price = Decimal("105.00")

# Calculate new average
total_cost = (current_qty * current_avg_cost) + (new_qty_to_buy * new_price)
# = (10 * 100.00) + (20 * 105.00)
# = 1000.00 + 2100.00
# = 3100.00

new_total_qty = current_qty + new_qty_to_buy
# = 10 + 20 = 30

new_avg_cost = total_cost / new_total_qty
# = 3100.00 / 30
# = Decimal('103.33333333') (many decimal places)

# Round to 2 places for storage (SQL TEXT field)
new_avg_cost_str = str(new_avg_cost.quantize(Decimal("0.01")))
# = "103.33"
```

**Critical:** All intermediate values must be `Decimal` initialized from strings. Never convert float → Decimal.

**Sources:** [VERIFIED: Phase 1 RESEARCH.md Pattern 4: Decimal Precision]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent trade execution | Custom locking via threading.Lock | SQLite `BEGIN IMMEDIATE` transaction | Database handles concurrency control; lock acquisition is atomic at the DB level, not Python-level |
| Trade validation logic | Separate validation route | Reuse `validate_trade_setup()` from Phase 1 service layer | Validation is consistent between GET (read-only check) and POST (execute); single source of truth |
| Average cost calculation on position upsert | Fetch, compute in Python, update | Calculate inside `BEGIN IMMEDIATE` transaction | Intermediate state must not be visible; calculation and storage are atomic |
| Portfolio snapshots | Scheduled via APScheduler or Celery | asyncio.create_task() in FastAPI lifespan | Simple single-process app; no need for external task queue; asyncio is sufficient |
| Trade error responses | Custom error formatting | FastAPI `HTTPException` with descriptive `detail` | FastAPI automatically serializes to JSON; consistent error format |

**Key insight:** Atomic transactions require both read and write in the same lock scope. Splitting validation and execution across separate database calls introduces a race condition window. Phase 2 must call `validate_trade_setup()` pre-transaction for optimization (no lock held), but re-validate inside the transaction before execution.

---

## Common Pitfalls

### Pitfall 1: Float Precision Loss in Position Updates
**What goes wrong:** Storing position quantities or average costs as floats in Python, calculating in float, then storing in database. Over many trades, accumulated float errors cause positions to be off by fractions of a cent.

**Why it happens:** IEEE 754 floating-point arithmetic is inexact for decimal values. 0.1 + 0.2 != 0.3 in binary float.

**How to avoid:** 
- Initialize all monetary values from strings: `Decimal(str(value))`, never `Decimal(float_value)`
- Perform all calculations in Decimal
- Convert to float only at JSON boundary (response serialization)
- Store in database as TEXT (preserves exact decimal representation)

**Warning signs:** 
- Position quantity shows 9.999999999 instead of 10.0
- Average cost becomes 101.04000000001 instead of 101.04
- Test assertions fail with "expected 52.50, got 52.500000000001"

**Verification:** Phase 2 tests include `test_decimal_precision()` that explicitly checks `Decimal` arithmetic.

---

### Pitfall 2: Race Condition Between Validation and Execution
**What goes wrong:** `validate_trade_setup()` checks cash balance, returns "OK", but between validation and execution, price spikes and the user no longer has enough cash. Trade fails mid-execution, leaving inconsistent state.

**Why it happens:** Validation and execution are separate database queries. Between them, the data can change.

**How to avoid:** 
- Call `validate_trade_setup()` pre-transaction to catch obvious errors early
- Inside `BEGIN IMMEDIATE` transaction, re-validate before execution
- If price has changed significantly, reject trade (not implemented in v1; acceptable for demo)

**Warning signs:** 
- Trade accepted in validation but fails with "insufficient cash" during execution
- Position is half-created (quantity updated, but cash not deducted)
- Database is left in inconsistent state on failure

**Verification:** Phase 2 tests include `test_trade_atomic_rollback()` that verifies rollback on validation failure.

---

### Pitfall 3: Snapshot Task Consumes All Database Connections
**What goes wrong:** Background `snapshot_loop()` holds a transaction open waiting to write, while a trade execution waits for a write lock. Eventually, one task times out and the app becomes unresponsive.

**Why it happens:** SQLite single-writer model + long-held transactions = contention.

**How to avoid:** 
- Each snapshot insertion is a quick, atomic transaction (write lock acquired, data inserted, released)
- Trade execution is also atomic (not long-lived)
- 30-second polling interval is fast enough for demo; doesn't create contention
- Use WAL mode (from Phase 1) to allow concurrent reads during writes

**Warning signs:** 
- App becomes unresponsive during trade execution
- Database locks on second concurrent operation
- Snapshots stop being recorded when heavy trading occurs

**Verification:** Phase 2 tests run multiple trades with snapshot task active; verify all complete without deadlock.

---

### Pitfall 4: Background Task Not Cancelled on Shutdown
**What goes wrong:** Snapshot task continues running after app shutdown signal, attempting database writes to a closed connection.

**Why it happens:** asyncio.create_task() doesn't automatically cancel on app exit; task must be explicitly cancelled in shutdown.

**How to avoid:** 
- Store task reference: `app.state.snapshot_task = asyncio.create_task(...)`
- In lifespan shutdown: `snapshot_task.cancel()` and `await snapshot_task` (expect `CancelledError`)
- Snapshot loop catches `asyncio.CancelledError` and exits gracefully

**Warning signs:** 
- "database is closed" error in logs after app shutdown
- Resource warnings about unclosed tasks
- App takes >5 seconds to shutdown

**Verification:** Phase 2 tests include shutdown tests that verify no errors after app close.

---

### Pitfall 5: Position Upsert Doesn't Handle Sell-to-Zero Correctly
**What goes wrong:** User sells all shares (quantity becomes 0), but the position row is left in the database with quantity=0. Frontend displays the position or portfolio calculation includes it.

**Why it happens:** UPDATE instead of DELETE when quantity reaches zero.

**How to avoid:** 
- On sell: if new_qty == 0, execute DELETE instead of UPDATE
- Or: filter positions in queries with `WHERE quantity > 0`

**Warning signs:** 
- Stale positions with quantity=0 appear in portfolio
- P&L includes zero-quantity positions (phantom gains/losses)

**Verification:** Phase 2 tests include `test_sell_to_zero()` that verifies position is deleted, not zeroed.

---

## Code Examples

### Example 1: Trade Execution Route

```python
# app/portfolio/routes.py
from fastapi import APIRouter, Depends, HTTPException
from app.portfolio.models import TradeRequest, TradeResponse
from app.portfolio.service import execute_trade
from app.dependencies import get_db, get_price_cache
from decimal import Decimal

def create_portfolio_router() -> APIRouter:
    router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])
    
    @router.post("/trade", response_model=TradeResponse)
    async def trade(
        request: TradeRequest,
        db: sqlite3.Connection = Depends(get_db),
        cache: PriceCache = Depends(get_price_cache),
    ) -> TradeResponse:
        """Execute a market buy or sell order.
        
        Validates ticker, side, quantity. Executes atomically via BEGIN IMMEDIATE.
        Records trade log entry and portfolio snapshot on success.
        """
        try:
            quantity_decimal = Decimal(str(request.quantity))
            result = await execute_trade(
                db, 
                request.ticker.upper(), 
                request.side.lower(), 
                quantity_decimal, 
                cache
            )
            return TradeResponse(**result)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    return router
```

**Sources:** [VERIFIED: Phase 1 pattern for routes with Depends()]

---

### Example 2: Snapshot Loop Task

```python
# app/background/tasks.py
async def snapshot_loop(
    db: sqlite3.Connection, 
    price_cache: PriceCache, 
    interval_seconds: int = 30
):
    """Record portfolio snapshots every N seconds."""
    try:
        while True:
            await asyncio.sleep(interval_seconds)
            
            async def _record():
                cursor = db.cursor()
                # Compute current portfolio value
                total_value = compute_portfolio_value(cursor, price_cache)
                # Insert snapshot
                cursor.execute(
                    """INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at)
                       VALUES (?, 'default', ?, datetime('now'))""",
                    (str(uuid.uuid4()), str(total_value)),
                )
                db.commit()
            
            await run_in_threadpool(_record)
    except asyncio.CancelledError:
        logger.info("Snapshot loop cancelled")
        raise
```

**Sources:** [VERIFIED: asyncio task pattern + run_in_threadpool integration]

---

### Example 3: Weighted Average Cost Calculation

```python
# During a buy that increases existing position:
current_qty = Decimal(str(pos_row[0]))  # 10
current_avg_cost = Decimal(str(pos_row[1]))  # 100.00

quantity_to_buy = Decimal(str(request.quantity))  # 5
current_price = Decimal(str(price_update.price))  # 110.00

new_qty = current_qty + quantity_to_buy  # 15
# Total value of all shares: (10 * 100) + (5 * 110) = 1550
total_value = (current_qty * current_avg_cost) + (quantity_to_buy * current_price)
new_avg_cost = total_value / new_qty  # 1550 / 15 = 103.33...

# Store as TEXT with 2 decimal places
cursor.execute(
    "UPDATE positions SET quantity=?, avg_cost=? WHERE ...",
    (str(new_qty), str(new_avg_cost)),
)
```

**Sources:** [VERIFIED: Phase 1 RESEARCH.md Pattern 4]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ThreadPoolExecutor background tasks | asyncio.create_task() | FastAPI 0.100+ | Simpler, no external task queue needed for single-process demo |
| aiosqlite for async DB | sync sqlite3 + run_in_threadpool | Performance analysis in Phase 1 | 15x faster for simple single-user queries; SQLite bottleneck is file locking, not I/O |
| Float arithmetic for money | Decimal from strings | Financial software standard | Exact representations; no accumulation errors |
| Separate validation and execution routes | Unified trade endpoint with BEGIN IMMEDIATE | Atomicity requirement | Prevents race conditions; validation and execution in single transaction |

**Deprecated/outdated:**
- **aiosqlite**: Not needed for single-user MVP. Sync sqlite3 is faster and simpler.
- **SQLAlchemy ORM**: Keep it simple for now. Raw SQL with Decimal works fine. Add ORM if multi-tenant emerges.
- **Separate snapshot service**: Background task in lifespan is built-in to FastAPI; no external service needed.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Portfolio snapshots should be recorded immediately after every trade (in same transaction) + every 30 seconds (background task) | Pattern 2 | If only scheduled: users see stale P&L after trades; missing immediate feedback |
| A2 | `BEGIN IMMEDIATE` is available and works in sqlite3 stdlib | Pattern 1 | If not: race conditions possible during trade validation → execution window |
| A3 | Position deletion (vs. zeroing quantity) is required when user sells all shares | Pitfall 5 | If not: portfolio display includes zero-quantity phantom positions |
| A4 | Trade validation must be called twice: once before txn (early error), once inside txn (final check) | Pattern 1 | If only once: stale data or phantom reads possible |
| A5 | Background snapshot loop can use `asyncio.CancelledError` for clean shutdown | Pattern 2 | If not: resource leaks or uncancelled tasks on shutdown |

All claims tagged `[ASSUMED]` are based on Phase 1 research and project constraints. Validation happens during Phase 2 planning.

---

## Open Questions

1. **Snapshot interval configurability**
   - What we know: Phase 2 uses hardcoded 30 seconds
   - What's unclear: Should it be configurable via environment variable (SNAPSHOT_INTERVAL_SECONDS)?
   - Recommendation: Hardcode 30s for v1; add env var if needed for scaling

2. **Fractional share support**
   - What we know: Schema allows `quantity REAL` (fractional shares)
   - What's unclear: Should UI limit to whole shares, or allow fractional?
   - Recommendation: Database supports fractional; frontend can limit to whole shares if desired

3. **Sell-to-zero edge case**
   - What we know: DELETE position when qty reaches 0
   - What's unclear: Should it also remove ticker from watchlist?
   - Recommendation: No; watchlist and positions are independent. User might want to watch a stock they don't own.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python | Runtime | ✓ | 3.12+ | — |
| sqlite3 | Database layer | ✓ | 3.x (bundled) | — |
| FastAPI | Web framework | ✓ | 0.115.0+ | — |
| asyncio | Background tasks | ✓ | 3.12 (stdlib) | — |
| Decimal | Monetary arithmetic | ✓ | 3.12 (stdlib) | — |

**No external dependencies added in Phase 2** — all required libraries are already in uv.lock or stdlib.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3.0+ with pytest-asyncio 0.24.0+ |
| Config file | `backend/pyproject.toml` (asyncio_mode = "auto") |
| Quick run command | `uv run --extra dev pytest backend/tests/test_portfolio.py::test_execute_trade_buy -xvs` |
| Full suite command | `uv run --extra dev pytest backend/tests/test_portfolio.py -v --cov=app.portfolio` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PORT-02 | User can buy 10 shares of AAPL; cash decreases by (10 × current_price), position is created | unit | `pytest backend/tests/test_portfolio.py::test_execute_trade_buy -xvs` | ✅ Wave 1 |
| PORT-02 | User cannot buy 1M shares without sufficient cash; buy is rejected with clear error | unit | `pytest backend/tests/test_portfolio.py::test_trade_insufficient_cash -xvs` | ❌ Wave 2 |
| PORT-02 | User can sell 5 shares of an owned position; position quantity decreases, cash increases | unit | `pytest backend/tests/test_portfolio.py::test_execute_trade_sell -xvs` | ❌ Wave 2 |
| PORT-02 | User cannot sell more shares than owned; sell is rejected with clear error | unit | `pytest backend/tests/test_portfolio.py::test_trade_insufficient_shares -xvs` | ❌ Wave 2 |
| PORT-02 | Atomicity: trade is all-or-nothing; on validation failure, database is unchanged | unit | `pytest backend/tests/test_portfolio.py::test_trade_atomic_rollback -xvs` | ✅ Phase 1 (reuse) |
| DATA-05 | Portfolio snapshots record total value every 30 seconds | integration | `pytest backend/tests/test_portfolio.py::test_snapshot_loop_30s -xvs` | ❌ Wave 3 |
| DATA-05 | Portfolio snapshot recorded immediately after each trade | unit | `pytest backend/tests/test_portfolio.py::test_snapshot_post_trade -xvs` | ❌ Wave 2 |

### Sampling Rate
- **Per task commit:** `pytest backend/tests/test_portfolio.py::test_execute_trade_buy -xvs` (< 2 seconds)
- **Per wave merge:** `pytest backend/tests/test_portfolio.py -v --cov=app.portfolio` (< 10 seconds)
- **Phase gate:** Full suite green + manual trading workflow test before `/gsd-verify-work`

### Wave 0 Gaps

**Test stubs needed before implementation begins:**

- [ ] `backend/tests/test_portfolio.py::test_execute_trade_buy` — covers PORT-02 (buy validation, position creation, cash deduction)
- [ ] `backend/tests/test_portfolio.py::test_trade_insufficient_cash` — covers PORT-02 (buy without enough cash → HTTP 400)
- [ ] `backend/tests/test_portfolio.py::test_execute_trade_sell` — covers PORT-02 (sell validation, position reduction, cash increase)
- [ ] `backend/tests/test_portfolio.py::test_trade_insufficient_shares` — covers PORT-02 (sell without enough shares → HTTP 400)
- [ ] `backend/tests/test_portfolio.py::test_snapshot_post_trade` — covers DATA-05 (snapshot recorded immediately after trade in same txn)
- [ ] `backend/tests/test_portfolio.py::test_snapshot_loop_30s` — covers DATA-05 (background task records snapshot every 30s)

**No new fixtures needed** — reuse `test_db`, `price_cache`, `client` from Phase 1 conftest.py.

**Framework setup:** Already complete in Phase 1. pytest-asyncio with `asyncio_mode = "auto"` handles async test functions.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A (single user, no auth) |
| V3 Session Management | no | N/A (single user, no sessions) |
| V4 Access Control | no | N/A (single user, no multi-tenant) |
| V5 Input Validation | yes | Pydantic models (TradeRequest) validate ticker, side, quantity before reaching service layer |
| V6 Cryptography | no | No sensitive data beyond asset prices (public); no encryption needed |
| V7 Error Handling | yes | HTTP exceptions return descriptive errors without exposing database state |
| V8 Data Protection | yes | Decimal precision prevents financial math errors; SQLite WAL mode prevents concurrent corruption |

### Known Threat Patterns for FastAPI + SQLite

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL Injection via ticker | Tampering | All SQL uses parameterized queries (?-placeholders); never concatenate user input |
| Race condition: validation vs execution | Tampering | Atomic transaction with BEGIN IMMEDIATE; entire trade flow locked |
| Float precision loss in P&L | Tampering | Decimal arithmetic; no float accumulation errors |
| Insufficient funds check bypassed | Tampering | Re-validate inside transaction; cache price may change between validation and execution |
| Position quantity goes negative | Tampering | Sell validation checks `quantity <= current_qty` before execution |
| Snapshot loop DOS | Denial of Service | 30-second interval is slow enough; not a bottleneck (single task, lightweight query) |

---

## Sources

### Primary (HIGH confidence)
- **Phase 1 RESEARCH.md** — Atomic transaction pattern (Pattern 3), Decimal precision (Pattern 4), run_in_threadpool (Pattern 2)
- **FastAPI official docs** — Lifespan context manager, dependency injection with Depends()
- **SQLite official docs** — BEGIN IMMEDIATE semantics, WAL mode concurrency

### Secondary (MEDIUM confidence)
- **Python asyncio docs** — create_task(), CancelledError handling
- **Pydantic v2 docs** — BaseModel validation, Field constraints

### Tertiary (verified in codebase)
- **backend/app/portfolio/service.py** — Existing validate_trade_setup(), compute_portfolio_value(), get_portfolio_data() (Phase 1)
- **backend/tests/test_portfolio.py** — Existing test patterns, fixtures from conftest.py

---

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH — All libraries are stable, production-tested (FastAPI, pytest, sqlite3)
- **Architecture:** HIGH — Atomic transaction and background task patterns are well-established in FastAPI community
- **Pitfalls:** HIGH — Float precision and race condition prevention are documented in Phase 1; assumed knowledge validated
- **Test coverage:** MEDIUM — Phase 2 adds new tests for trade execution and snapshots; reuses Phase 1 fixtures and database setup

**Research date:** 2026-04-10  
**Valid until:** 2026-04-17 (7 days — finance/transaction code can change rapidly; snapshot schema may need adjustment based on performance)

**Key references to carry forward:**
- Phase 1: `validate_trade_setup()` function signature and behavior
- Phase 1: `compute_portfolio_value()` function signature
- Phase 1: Decimal initialization pattern (always from strings)
- Phase 1: run_in_threadpool pattern for async-wrapping sync code
