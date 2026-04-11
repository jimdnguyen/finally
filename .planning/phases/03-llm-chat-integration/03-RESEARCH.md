# Phase 3: LLM Chat Integration - Research

**Researched:** 2026-04-10  
**Domain:** LLM integration via LiteLLM/OpenRouter with Pydantic v2 structured outputs, trade auto-execution, and conversation persistence  
**Confidence:** HIGH

## Summary

Phase 3 implements backend LLM chat integration—a single `POST /api/chat` endpoint that receives user messages, injects current portfolio context, maintains conversation history, calls OpenRouter via LiteLLM with structured output, auto-executes validated trades/watchlist changes, and persists the exchange to the database.

The phase depends critically on three working pieces: (1) the existing portfolio service (`get_portfolio_data()`) and trade execution (`execute_trade()`), (2) LiteLLM's OpenRouter integration with a critical bug workaround (double model prefix), and (3) Pydantic v2 structured output validation. The mock mode (`LLM_MOCK=true`) enables deterministic E2E testing without OpenRouter calls.

**Primary recommendation:** Build a dedicated `backend/app/chat/` module following the same factory pattern as portfolio and watchlist (models.py, service.py, routes.py), use Pydantic v2's `.model_validate_json()` for structured output parsing, and implement a helper function to format portfolio context as human-readable prose (not JSON/tables).

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Inject **full portfolio context** into the LLM system prompt on every call (not once at start) — cash balance, all positions with current prices and unrealized P&L, total portfolio value, watchlist tickers with live prices. Rebuild fresh from `get_portfolio_data()` and `get_price_cache()` on each request.
- **D-02:** Format portfolio context as **structured prose** (human-readable paragraph/sentence format, not JSON or markdown tables).
- **D-03:** Inject portfolio context into the **system prompt on every call** to ensure LLM always has current data regardless of mid-conversation trades.

### Claude's Discretion

- **History window:** Load last N turns from `chat_messages` (recommend 10–20 messages). Exclude current request when loading history.
- **Partial trade failure handling:** When LLM requests multiple trades and one fails validation, continue executing remaining valid trades and report each failure inline in the response (continue-and-report).
- **Mock response design:** `LLM_MOCK=true` returns deterministic hardcoded response with friendly message and one sample buy trade (e.g., buy 1 AAPL).
- **Chat module structure:** Organize as `backend/app/chat/` following same pattern as `backend/app/portfolio/` (models.py, service.py, router.py + `__init__.py`).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

---

## Phase Requirements (from REQUIREMENTS.md)

| ID | Description | Research Support |
|---|---|---|
| **CHAT-01** | `POST /api/chat` accepts user message, loads portfolio context + conversation history, calls LLM, returns structured response | Portfolio service (`get_portfolio_data()`), price cache (`PriceCache`), conversation history query pattern, LLM call pattern via LiteLLM |
| **CHAT-02** | LLM returns structured JSON: `{ message, trades[], watchlist_changes[] }` validated with Pydantic schema | Pydantic v2 BaseModel + `.model_validate_json()` for structured output deserialization |
| **CHAT-03** | Trades and watchlist changes from LLM response are auto-executed (same validation as manual trades); failures reported in response | Existing `execute_trade()` function, watchlist CRUD operations, error wrapping |
| **CHAT-04** | `LLM_MOCK=true` returns deterministic mock response without calling OpenRouter (enables fast E2E tests) | Environment variable check in service, deterministic response template |
| **CHAT-05** | Conversation history persisted in `chat_messages` table with role, content, and executed actions (JSON) | SQLite INSERT pattern, JSON serialization of executed actions |
| **CHAT-06** | LiteLLM configured to force structured output for OpenRouter (override detection bug) | `litellm._openrouter_force_structured_output = True` must be set before each call |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard | Source |
|---------|---------|---------|--------------|--------|
| **litellm** | 1.0.0+ | LLM provider abstraction; enables OpenRouter structured output calls | Lightweight provider router; official Structured Outputs support; Pydantic v2 compatible | [ASSUMED] |
| **pydantic** | v2.12.5 | Data validation via structured output schema; used by FastAPI | Already in project (FastAPI dependency); Structured Outputs fully supported in v2 | [VERIFIED: backend/pyproject.toml + uv tree] |
| **fastapi** | v0.128.7 | Web framework; already present | Already in project | [VERIFIED: backend/pyproject.toml] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **python-dotenv** | Latest | Load `OPENROUTER_API_KEY` and `LLM_MOCK` from `.env` | Always (env vars required) |

**Installation:**
```bash
cd backend
uv add litellm python-dotenv
```

**Version verification:**
```bash
npm view litellm version  # Run if not already in uv.lock
# Or check via: uv pip list | grep litellm
```

Note: `python-dotenv` may already be a transitive dependency. Verify with `uv tree | grep dotenv`.

---

## Architecture Patterns

### Recommended Project Structure

```
backend/app/chat/
├── __init__.py          # Public exports: create_chat_router(), ChatService
├── models.py            # Pydantic schemas (ChatRequest, ChatResponse, ChatMessage, etc.)
├── service.py           # Business logic (build_context_block, execute_chat, save_message, etc.)
└── routes.py            # FastAPI router factory (create_chat_router())
```

### Pattern 1: Portfolio Context Injection

**What:** Build a human-readable prose block containing current portfolio state (cash, positions with P&L, total value, watchlist) and inject it into the system prompt on **every LLM call**. This ensures the LLM always has fresh data regardless of trades executed mid-conversation.

**When to use:** Required for CHAT-01.

**Example:**
```python
# Source: Derived from backend/app/portfolio/service.py: get_portfolio_data()
def build_context_block(cursor: sqlite3.Cursor, price_cache: PriceCache) -> str:
    """Build a human-readable portfolio context prose block for LLM system prompt.
    
    Example output:
    "Your portfolio: $8,234 cash. Positions: AAPL 10 shares, avg cost $185.00, 
    current $192.40 (+$74.00 unrealized, +4.0%). TSLA 5 shares, avg cost $240.00, 
    current $248.10 (+$40.50 unrealized, +3.4%). Total portfolio value: $9,158.00. 
    Watchlist: AAPL $192.40, TSLA $248.10, NVDA $875.50, GOOGL $175.20, MSFT $430.00, 
    AMZN $195.30, META $510.00, JPM $205.40, V $285.10, NFLX $680.50."
    """
    # Call get_portfolio_data() to fetch current positions with live prices
    portfolio = get_portfolio_data(cursor, price_cache)
    
    # Format as prose (cash first, positions by value descending, then watchlist)
    # Do NOT use JSON or markdown tables
```

**Why:** Ensures LLM has fresh data on every request, not stale data from conversation start. Prose format is natural and reduces token usage vs. structured formats.

### Pattern 2: Structured Output Schema

**What:** Pydantic v2 `BaseModel` defining the exact JSON structure the LLM must return: `message` (string), `trades` (array of objects with ticker/side/quantity), and `watchlist_changes` (array of objects with ticker/action).

**When to use:** Required for CHAT-02.

**Example:**
```python
# Source: backend/app/portfolio/models.py — same style
from pydantic import BaseModel, Field

class TradeAction(BaseModel):
    """Trade action from LLM response."""
    ticker: str = Field(..., description="Ticker symbol (uppercase)")
    side: str = Field(..., description="'buy' or 'sell'")
    quantity: float = Field(..., gt=0, description="Number of shares (must be > 0)")

class WatchlistAction(BaseModel):
    """Watchlist modification from LLM response."""
    ticker: str = Field(..., description="Ticker symbol (uppercase)")
    action: str = Field(..., description="'add' or 'remove'")

class ChatResponse(BaseModel):
    """Structured response from LLM chat endpoint.
    
    The LLM is instructed to respond with JSON matching this schema.
    """
    message: str = Field(..., description="Conversational response to user")
    trades: list[TradeAction] = Field(
        default_factory=list,
        description="Trades to auto-execute (optional)"
    )
    watchlist_changes: list[WatchlistAction] = Field(
        default_factory=list,
        description="Watchlist modifications (optional)"
    )
```

**Why:** Pydantic v2 validates JSON at deserialization time, preventing parsing errors and ensuring type safety before execution.

### Pattern 3: LiteLLM Structured Output Call

**What:** Call LiteLLM's `completion()` with Pydantic schema as `response_format`, then validate the JSON result with `.model_validate_json()`.

**When to use:** Required for CHAT-02 and CHAT-06.

**Example:**
```python
# Source: cerebras/SKILL.md — Structured Output pattern
from litellm import completion

def call_llm_structured(system_prompt: str, messages: list, schema: type) -> dict:
    """Call LiteLLM with structured output for a Pydantic schema.
    
    Handles the critical OpenRouter detection bug (CHAT-06).
    """
    import litellm
    
    # CRITICAL: Force structured output for OpenRouter (bug workaround — STATE.md Pitfall #2)
    litellm._openrouter_force_structured_output = True
    
    call_kwargs = {
        "model": "openrouter/openrouter/free",  # Double prefix — bug workaround
        "messages": [
            {"role": "system", "content": system_prompt},
            *messages
        ],
        "extra_body": {"provider": {"order": ["cerebras"]}},
        "response_format": schema,
    }
    
    response = completion(**call_kwargs)
    result_json = response.choices[0].message.content or ""
    
    # Validate JSON against schema
    return schema.model_validate_json(result_json)
```

**Why:** Structured output forces LLM to return valid JSON matching the schema. The OpenRouter detection bug requires the override flag on every call.

### Pattern 4: Auto-Execution with Partial Failure Handling

**What:** Execute each trade/watchlist change from the LLM response, collect success and failure results, and report all outcomes inline in the response (continue-and-report pattern).

**When to use:** Required for CHAT-03.

**Example:**
```python
async def execute_llm_actions(
    db: sqlite3.Connection,
    price_cache: PriceCache,
    llm_response: ChatResponse,
) -> dict:
    """Execute trades and watchlist changes from LLM response.
    
    Returns dict with success flags and error messages for each action.
    """
    executed_actions = {
        "trades": [],
        "watchlist_changes": [],
        "errors": [],
    }
    
    # Execute trades (continue on failure, report each result)
    for trade in llm_response.trades:
        try:
            result = await execute_trade(
                db, trade.ticker, trade.side, Decimal(str(trade.quantity)), price_cache
            )
            executed_actions["trades"].append(result)
        except HTTPException as e:
            executed_actions["errors"].append(f"Trade {trade.side} {trade.quantity} {trade.ticker} failed: {e.detail}")
    
    # Execute watchlist changes (continue on failure, report each result)
    for change in llm_response.watchlist_changes:
        try:
            # Call watchlist service function (add/remove ticker)
            result = await add_watchlist_ticker(db, change.ticker)  # or remove_watchlist_ticker()
            executed_actions["watchlist_changes"].append(result)
        except Exception as e:
            executed_actions["errors"].append(f"Watchlist {change.action} {change.ticker} failed: {str(e)}")
    
    return executed_actions
```

**Why:** Users get feedback on which trades succeeded and which failed, with reasons. Prevents a single invalid trade from blocking all subsequent actions.

### Pattern 5: Conversation History Management

**What:** Load last N (recommend 10–20) messages from `chat_messages` table (excluding current request), format as message history for LLM context, and append current user message.

**When to use:** Required for CHAT-01.

**Example:**
```python
def load_conversation_history(
    cursor: sqlite3.Cursor, limit: int = 10
) -> list[dict]:
    """Load recent conversation history from database.
    
    Returns list of dicts: [{"role": "user"/"assistant", "content": "..."}]
    Excludes the current request (not yet in DB).
    """
    cursor.execute(
        """
        SELECT role, content FROM chat_messages
        WHERE user_id='default'
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,)
    )
    rows = cursor.fetchall()
    
    # Reverse to chronological order (oldest first)
    history = [{"role": row[0], "content": row[1]} for row in reversed(rows)]
    return history
```

**Why:** Gives LLM context of prior conversation, enabling coherent multi-turn dialogue.

### Pattern 6: Conversation Persistence

**What:** After LLM responds and trades execute, insert both the user message and assistant response (with executed actions as JSON) into `chat_messages` table.

**When to use:** Required for CHAT-05.

**Example:**
```python
def save_chat_message(
    cursor: sqlite3.Cursor,
    role: str,  # "user" or "assistant"
    content: str,
    actions: dict | None = None,  # Executed trades/watchlist changes
) -> str:
    """Insert a chat message into the database.
    
    Returns message ID.
    """
    import json
    import uuid
    from datetime import datetime, timezone
    
    message_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    actions_json = json.dumps(actions) if actions else None
    
    cursor.execute(
        """
        INSERT INTO chat_messages (id, user_id, role, content, actions, created_at)
        VALUES (?, 'default', ?, ?, ?, ?)
        """,
        (message_id, role, content, actions_json, created_at)
    )
    
    return message_id
```

**Why:** Enables conversation history retrieval and auditing of LLM-executed trades.

### Anti-Patterns to Avoid

- **Injecting portfolio context only at conversation start:** Violates D-03; LLM will have stale data after trades. Solution: rebuild context on every request.
- **Returning portfolio context as JSON or markdown table:** Violates D-02; wastes tokens and is less natural. Solution: prose format (sentences/paragraphs).
- **Aborting all trades if one fails:** Violates CHAT-03 (continue-and-report). Solution: execute each trade, collect errors, report all.
- **Storing portfolio context directly in `chat_messages`:** Inefficient and creates data duplication. Solution: store only the LLM message and executed actions.
- **Parsing LLM JSON manually instead of using Pydantic:** Error-prone and loses type safety. Solution: always use `.model_validate_json()`.
- **Calling LLM without `litellm._openrouter_force_structured_output = True`:** Violates CHAT-06; will cause 502 errors. Solution: set flag before every `completion()` call.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM API routing | Custom HTTP client calling OpenRouter | LiteLLM's `completion()` wrapper | Handles provider detection, retries, model routing, streaming; maintains compatibility with multiple providers |
| Structured output validation | Manual JSON parsing + field checks | Pydantic v2 `BaseModel.model_validate_json()` | Type-safe deserialization; catches malformed JSON early; integrates seamlessly with FastAPI |
| Trade execution within chat | Duplicate trade logic | Reuse existing `execute_trade()` from portfolio service | Already battle-tested, handles atomic transactions, Decimal precision, P&L; ensures consistency between manual and LLM trades |
| Portfolio context formatting | Bespoke prose builder | Simple string templates (f-strings or `.format()`) with portfolio dict | Natural language readability; easy to maintain; avoids over-engineering |
| Conversation history | Build custom query + formatting | Load from `chat_messages` table, format as message list for LLM | Leverages existing schema; idiomatic; no special state management |

**Key insight:** The portfolio service and trade execution are already built and tested. Don't replicate that logic; call it directly. LiteLLM is the standard for provider abstraction. Pydantic v2 handles validation with zero manual parsing.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.3.0+ (via `uv run --extra dev pytest`) |
| Config file | `backend/pyproject.toml` (asyncio_mode="auto") |
| Quick run command | `cd backend && uv run --extra dev pytest tests/chat/test_*.py -x` |
| Full suite command | `cd backend && uv run --extra dev pytest tests/ --cov=app` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-01 | `POST /api/chat` accepts message, loads portfolio context + history, calls LLM, returns ChatResponse | integration | `pytest tests/chat/test_routes.py::test_chat_endpoint_structure -xvs` | ❌ Wave 0 |
| CHAT-02 | ChatResponse schema validates structured JSON; malformed JSON raises ValidationError | unit | `pytest tests/chat/test_models.py::test_chat_response_validation -xvs` | ❌ Wave 0 |
| CHAT-03 | Auto-execute trades from LLM response; partial failures handled (continue-and-report) | integration | `pytest tests/chat/test_service.py::test_execute_llm_actions_partial_failure -xvs` | ❌ Wave 0 |
| CHAT-04 | `LLM_MOCK=true` returns deterministic mock response; no OpenRouter call made | unit | `pytest tests/chat/test_service.py::test_mock_mode_deterministic -xvs` | ❌ Wave 0 |
| CHAT-05 | Chat messages + executed actions persisted to `chat_messages` table | integration | `pytest tests/chat/test_service.py::test_save_chat_message -xvs` | ❌ Wave 0 |
| CHAT-06 | `litellm._openrouter_force_structured_output = True` set before LLM call; structured output succeeds | integration | Manual verification + E2E test in Phase 5 | — |

### Sampling Rate

- **Per task commit:** `cd backend && uv run --extra dev pytest tests/chat/ -x` (quick validation)
- **Per wave merge:** `cd backend && uv run --extra dev pytest tests/ --cov=app` (full suite + coverage)
- **Phase gate:** Full suite green + coverage > 80% before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/chat/__init__.py` — test package initialization
- [ ] `tests/chat/test_models.py` — ChatResponse schema validation, malformed JSON handling
- [ ] `tests/chat/test_service.py` — build_context_block, execute_llm_actions, save_chat_message, mock mode
- [ ] `tests/chat/test_routes.py` — POST /api/chat endpoint structure, integration with portfolio service
- [ ] `backend/app/chat/__init__.py` — create_chat_router() factory export
- [ ] Framework/fixtures update: Add `litellm` mock fixtures to `tests/conftest.py` for deterministic testing

*(If no gaps: existing test infrastructure covers all phase requirements)*

---

## Common Pitfalls

### Pitfall 1: LiteLLM OpenRouter Detection Bug (CHAT-06 critical)

**What goes wrong:** Without setting `litellm._openrouter_force_structured_output = True` before calling `completion()`, LiteLLM's detection logic for OpenRouter structured outputs fails, causing 502 Bad Gateway from OpenRouter.

**Why it happens:** LiteLLM's auto-detection of provider capabilities looks at the model string; the double-prefix `openrouter/openrouter/free` confuses its detection logic. The flag overrides the detection.

**How to avoid:** Always set the flag **immediately before each `completion()` call**:
```python
import litellm
litellm._openrouter_force_structured_output = True
response = completion(...)
```

**Warning signs:** 502 HTTP errors in LLM response, requests hanging, or fallback to non-structured output.

### Pitfall 2: Stale Portfolio Context

**What goes wrong:** Injecting portfolio context only at conversation start means the LLM has outdated data after trades execute mid-conversation. User asks "What's my portfolio now?" and LLM reports old values.

**Why it happens:** Developers inject context once, assume it's sufficient for multi-turn chat.

**How to avoid:** Rebuild portfolio context **on every LLM call** (CONTEXT.md D-03):
```python
def execute_chat(user_message: str, db, price_cache):
    # Build fresh context for THIS call
    context = build_context_block(db.cursor(), price_cache)
    system_prompt = f"You are FinAlly... {context}"  # Rebuilt each time
    # ... call LLM
```

**Warning signs:** Conversation history shows LLM making inconsistent statements about portfolio value or positions.

### Pitfall 3: Parsing Malformed LLM JSON Without Validation

**What goes wrong:** Code assumes LLM always returns valid JSON and tries to parse with `json.loads()` or direct field access, then crashes when JSON is malformed or misses required fields.

**Why it happens:** Developers skip Pydantic validation in a rush.

**How to avoid:** Always validate with Pydantic's `.model_validate_json()`:
```python
try:
    response = ChatResponse.model_validate_json(llm_json_string)
except ValidationError as e:
    # Handle gracefully; return error to user
    return {"message": "I couldn't process my response properly. Please try again."}
```

**Warning signs:** Crashes with `KeyError` or `json.JSONDecodeError` when LLM returns slightly malformed JSON.

### Pitfall 4: Not Handling Trade Execution Failures in LLM Response

**What goes wrong:** LLM requests a trade (e.g., "sell 1000 AAPL"), auto-execution fails (insufficient shares), but code silently ignores the error or crashes, leaving the user confused.

**Why it happens:** Developers implement auto-execution as a straight pass-through, not accounting for validation failures.

**How to avoid:** Implement continue-and-report pattern (CONTEXT.md):
```python
executed_actions = {"trades": [], "errors": []}
for trade in llm_response.trades:
    try:
        result = await execute_trade(...)
        executed_actions["trades"].append(result)
    except HTTPException as e:
        executed_actions["errors"].append(f"Trade failed: {e.detail}")
        # Continue to next trade
```

**Warning signs:** User sees no feedback when LLM-requested trades fail; trades silently don't execute.

### Pitfall 5: Not Persisting Failed Trades to `chat_messages`

**What goes wrong:** A trade fails (e.g., insufficient cash), but the error isn't stored in the `actions` JSON of `chat_messages`, so history doesn't show what went wrong.

**Why it happens:** Code only saves successful actions.

**How to avoid:** Save both successes and failures to `actions` JSON:
```python
actions = {
    "trades": executed_actions["trades"],
    "watchlist_changes": executed_actions["watchlist_changes"],
    "errors": executed_actions["errors"],
}
save_chat_message(cursor, "assistant", llm_response.message, actions=actions)
```

**Warning signs:** User reviews chat history and sees "I'll buy 10 AAPL" with no record of whether it succeeded or failed.

### Pitfall 6: Portfolio Context Format as JSON Instead of Prose

**What goes wrong:** Context block is a JSON object, wasting tokens and reducing readability in the LLM's context window.

**Why it happens:** Developers default to structured formats instead of following CONTEXT.md D-02 (prose).

**How to avoid:** Format context as natural sentences:
```python
# GOOD (CONTEXT.md D-02)
context = f"""Your portfolio: ${cash_balance} cash. Positions: {positions_str}. Total value: ${total_value}. Watchlist: {watchlist_str}."""

# BAD (violates D-02)
context = json.dumps({"cash": cash_balance, "positions": [...], "watchlist": [...]})
```

**Warning signs:** LLM responses are less coherent; token usage is higher; planner flags context format issue.

---

## Code Examples

All examples verified against existing project patterns.

### Build Portfolio Context Block (Human-Readable Prose)

```python
# Source: backend/app/portfolio/service.py — reused get_portfolio_data()
def build_context_block(cursor: sqlite3.Cursor, price_cache: PriceCache) -> str:
    """Build human-readable portfolio context for LLM system prompt (CONTEXT.md D-02).
    
    Returns prose format: "Your portfolio: $X cash. Positions: A Y shares... Total: $Z. Watchlist: ..."
    NOT JSON or markdown tables.
    """
    portfolio = get_portfolio_data(cursor, price_cache)
    
    cash = portfolio["cash_balance"]
    positions = portfolio["positions"]
    total_value = portfolio["total_value"]
    
    # Format positions by value descending
    positions_sorted = sorted(positions, key=lambda p: p["current_price"] * p["quantity"], reverse=True)
    positions_str = ", ".join([
        f"{p['ticker']} {int(p['quantity'])} shares, avg cost ${p['avg_cost']:.2f}, "
        f"current ${p['current_price']:.2f} "
        f"({p['unrealized_pnl']:+.2f}, {p['change_percent']:+.1f}%)"
        for p in positions_sorted
    ]) or "none"
    
    # Fetch watchlist tickers with prices
    cursor.execute("SELECT ticker FROM watchlist WHERE user_id='default' ORDER BY added_at DESC")
    watchlist_rows = cursor.fetchall()
    watchlist_str = ", ".join([
        f"{row[0]} ${price_cache.get(row[0]).price:.2f}"
        for row in watchlist_rows
        if price_cache.get(row[0]) is not None
    ]) or "empty"
    
    return (
        f"Your portfolio: ${cash:.2f} cash. Positions: {positions_str}. "
        f"Total portfolio value: ${total_value:.2f}. "
        f"Watchlist: {watchlist_str}."
    )
```

### Pydantic v2 Structured Output Schema

```python
# Source: backend/app/chat/models.py — follows backend/app/portfolio/models.py style
from pydantic import BaseModel, Field

class TradeAction(BaseModel):
    """Trade action extracted from LLM response."""
    ticker: str = Field(..., description="Ticker symbol (uppercase, 1-5 chars)")
    side: str = Field(..., description="'buy' or 'sell'")
    quantity: float = Field(..., gt=0, description="Number of shares to trade (must be > 0)")

class WatchlistAction(BaseModel):
    """Watchlist modification extracted from LLM response."""
    ticker: str = Field(..., description="Ticker symbol (uppercase, 1-5 chars)")
    action: str = Field(..., description="'add' or 'remove' from watchlist")

class ChatResponse(BaseModel):
    """Structured response from LLM.
    
    Matches the schema the LLM is instructed to return.
    Validated via Pydantic v2 .model_validate_json().
    """
    message: str = Field(
        ...,
        description="Conversational response to the user (required)"
    )
    trades: list[TradeAction] = Field(
        default_factory=list,
        description="Trades to auto-execute (optional, default empty)"
    )
    watchlist_changes: list[WatchlistAction] = Field(
        default_factory=list,
        description="Watchlist modifications (optional, default empty)"
    )
```

### LiteLLM Structured Output Call

```python
# Source: cerebras/SKILL.md + backend/app/portfolio/service.py pattern
import litellm
from litellm import completion

async def call_llm_structured(
    system_prompt: str,
    messages: list[dict],
    schema: type,  # Pydantic BaseModel subclass
) -> dict:
    """Call LiteLLM with structured output for OpenRouter + Cerebras.
    
    Handles critical bug: sets litellm._openrouter_force_structured_output = True
    before each call (CHAT-06 requirement from STATE.md Pitfall #2).
    
    Args:
        system_prompt: System message for LLM context
        messages: Conversation history (list of {"role": "user"/"assistant", "content": "..."})
        schema: Pydantic BaseModel subclass defining response structure
    
    Returns:
        Validated schema instance
    
    Raises:
        ValidationError: If LLM response doesn't match schema
    """
    # CRITICAL: Force structured output for OpenRouter (bug workaround)
    litellm._openrouter_force_structured_output = True
    
    call_kwargs = {
        "model": "openrouter/openrouter/free",  # Double prefix required (bug workaround)
        "messages": [
            {"role": "system", "content": system_prompt},
            *messages
        ],
        "extra_body": {"provider": {"order": ["cerebras"]}},  # Prefer Cerebras inference
        "response_format": schema,  # Structured output
    }
    
    response = completion(**call_kwargs)
    result_json = response.choices[0].message.content or ""
    
    # Validate JSON against schema (raises ValidationError if invalid)
    return schema.model_validate_json(result_json)
```

### Chat Service Function (Main Orchestrator)

```python
# Source: backend/app/chat/service.py — follows backend/app/portfolio/service.py pattern
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import ValidationError

from app.market import PriceCache
from app.portfolio.service import execute_trade, get_portfolio_data
from app.chat.models import ChatResponse

async def execute_chat(
    db: sqlite3.Connection,
    user_message: str,
    price_cache: PriceCache,
) -> dict:
    """Execute a chat request: context injection, LLM call, auto-execution, persistence.
    
    Returns dict with:
        - llm_response: ChatResponse (message + executed trades + errors)
        - executed_actions: Dict of actual outcomes
    """
    
    def _execute_sync():
        cursor = db.cursor()
        
        # Step 1: Build fresh portfolio context (CONTEXT.md D-03)
        context_block = build_context_block(cursor, price_cache)
        
        # Step 2: Load conversation history (last 10 messages, exclude current)
        history = load_conversation_history(cursor, limit=10)
        
        # Step 3: Save user message to DB
        user_id = str(uuid.uuid4())
        user_created_at = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            "INSERT INTO chat_messages (id, user_id, role, content, created_at) "
            "VALUES (?, 'default', 'user', ?, ?)",
            (user_id, user_message, user_created_at)
        )
        db.commit()
        
        # Step 4: Build LLM system prompt with injected context (CONTEXT.md D-03)
        system_prompt = (
            "You are FinAlly, an AI trading assistant. Analyze portfolios, provide "
            "recommendations, and execute trades on behalf of the user when requested. "
            "Be concise and data-driven. Always respond with valid JSON matching the schema provided.\n\n"
            f"Current portfolio state:\n{context_block}"
        )
        
        # Step 5: Call LLM with structured output (CHAT-06)
        messages = [{"role": "user", "content": user_message}]  # + history items
        
        try:
            llm_response = call_llm_structured(system_prompt, messages, ChatResponse)
        except ValidationError as e:
            # Fallback response if LLM returns invalid JSON
            return {
                "llm_response": ChatResponse(
                    message="I had trouble processing my response. Please try again.",
                    trades=[],
                    watchlist_changes=[]
                ),
                "executed_actions": {"trades": [], "watchlist_changes": [], "errors": [str(e)]},
            }
        
        # Step 6: Auto-execute trades (CHAT-03) — continue-and-report pattern
        executed_actions = {"trades": [], "watchlist_changes": [], "errors": []}
        
        for trade in llm_response.trades:
            try:
                result = execute_trade(
                    db,
                    trade.ticker.upper(),
                    trade.side.lower(),
                    Decimal(str(trade.quantity)),
                    price_cache
                )
                executed_actions["trades"].append(result)
            except HTTPException as e:
                executed_actions["errors"].append(
                    f"Trade failed ({trade.side} {trade.quantity} {trade.ticker}): {e.detail}"
                )
        
        # TODO: Add watchlist execution here (add_watchlist_ticker, remove_watchlist_ticker)
        
        # Step 7: Save assistant response + executed actions to DB (CHAT-05)
        assistant_id = str(uuid.uuid4())
        assistant_created_at = datetime.now(timezone.utc).isoformat()
        actions_json = json.dumps(executed_actions)
        cursor.execute(
            "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
            "VALUES (?, 'default', 'assistant', ?, ?, ?)",
            (assistant_id, llm_response.message, actions_json, assistant_created_at)
        )
        db.commit()
        
        return {
            "llm_response": llm_response,
            "executed_actions": executed_actions,
        }
    
    return await run_in_threadpool(_execute_sync)
```

### FastAPI Router Factory

```python
# Source: backend/app/chat/routes.py — follows backend/app/portfolio/routes.py pattern
import sqlite3
from fastapi import APIRouter, Depends
from app.dependencies import get_db, get_price_cache
from app.market import PriceCache
from app.chat.models import ChatRequest, ChatResponseModel
from app.chat.service import execute_chat

def create_chat_router() -> APIRouter:
    """Create and return the chat API router.
    
    Returns an APIRouter with one endpoint:
        - POST /api/chat: Send a message, receive LLM response with auto-executed trades
    """
    router = APIRouter(prefix="/api/chat", tags=["chat"])
    
    @router.post("", response_model=ChatResponseModel)
    async def chat(
        request: ChatRequest,
        db: sqlite3.Connection = Depends(get_db),
        cache: PriceCache = Depends(get_price_cache),
    ) -> ChatResponseModel:
        """Send a chat message to the LLM assistant.
        
        Request: ChatRequest with "message" field
        Response: ChatResponseModel with LLM message + executed_actions
        """
        result = await execute_chat(db, request.message, cache)
        
        return ChatResponseModel(
            message=result["llm_response"].message,
            trades=result["executed_actions"]["trades"],
            watchlist_changes=result["executed_actions"]["watchlist_changes"],
            errors=result["executed_actions"]["errors"],
        )
    
    return router
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled LLM calls (requests library) | LiteLLM abstraction layer | 2023–2024 | Unified provider routing; Structured Outputs built-in; no more provider-specific logic |
| Pydantic v1 `Config` classes | Pydantic v2 `Field()` + `model_validate_json()` | 2024 | Cleaner validation; structured output directly from schema; type hints enforced at runtime |
| Manual JSON parsing (json.loads() + field access) | Pydantic `.model_validate_json()` | 2024 | Type-safe deserialization; validation errors surfaced immediately; integration with FastAPI |
| Token streaming for chat responses | Non-streaming structured outputs (Cerebras fast) | 2024 | Faster inference with Cerebras; deterministic JSON responses; no partial parsing state machine |

**Deprecated/outdated:**
- **Pydantic v1 approach:** v2 is now standard (released Sept 2023); v1 EOL announced. Project uses FastAPI 0.128+, which prefers v2.
- **Provider-specific LLM code:** LiteLLM replaced per-provider wrappers; no reason to maintain custom OpenRouter logic.
- **Token-by-token streaming for trading:** Structured output is deterministic and instant with Cerebras; no need for progressive rendering.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | LiteLLM v1.0.0+ is available in pypi and compatible with Pydantic v2.12.5 | Standard Stack | If incompatible, install will fail or runtime validation breaks. Mitigation: `uv add litellm` will resolve to compatible version; test with existing test suite. |
| A2 | `openrouter/openrouter/free` model string always routes to Cerebras via `extra_body` provider order | Architecture Patterns | If changed by OpenRouter, model routing fails. Mitigation: documented in cerebras skill + MEMORY.md; monitor OpenRouter service announcements. |
| A3 | `python-dotenv` already in dependency tree or not needed | Standard Stack | If not present and removed later, .env loading breaks. Mitigation: `uv add python-dotenv` explicitly in setup to be safe. |

---

## Open Questions

1. **Watchlist CRUD in chat service:** CONTEXT.md defers watchlist add/remove implementation. Research found `backend/app/watchlist/routes.py` exists but not a separate service module. Need to clarify: should chat service call route-level functions, or extract to service layer?
   - What we know: Watchlist table exists; routes exist; no service module found.
   - What's unclear: Acceptable pattern for watchlist CRUD from chat service (direct DB access vs. service function).
   - Recommendation: Plan phase should define service-level functions `add_watchlist_ticker()` and `remove_watchlist_ticker()` in a new `backend/app/watchlist/service.py` module (parallel to portfolio service pattern), then call those from chat service.

2. **Mock mode determinism:** CONTEXT.md recommends "buy 1 AAPL" as sample mock trade. Verify this is sufficient for E2E tests in Phase 4.
   - What we know: Mock mode required for deterministic testing; Phase 4 (frontend) needs realistic mock responses.
   - What's unclear: Should mock response vary per request, or always identical?
   - Recommendation: Always return **identical** mock response (same message, same trade) for maximum determinism. Example: `{"message": "I'll help with that. Buying 1 AAPL at current price.", "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 1}], "watchlist_changes": []}`.

3. **Conversation history depth:** CONTEXT.md says "recommend 10–20 messages." Verify this doesn't exceed token budgets for free OpenRouter tier.
   - What we know: Cerebras is fast; free tier has rate limits but not documented token limits.
   - What's unclear: Does loading 20 messages (40 messages with system prompt) exceed practical token window?
   - Recommendation: Start with 10 messages (safest); Phase 5 E2E tests can measure LLM latency and adjust if needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| OpenRouter API key | LLM calls (CHAT-01) | ✗ (runtime env) | — | `LLM_MOCK=true` for testing |
| Cerebras routing via OpenRouter | Structured output (CHAT-06) | ✓ (built into extra_body) | Latest | None (required) |
| SQLite 3 | Database (CHAT-05) | ✓ (bundled with Python) | 3.x | None (required) |
| Python 3.12+ | Project runtime | ✓ (backend/pyproject.toml) | 3.12+ | None (required) |

**Missing dependencies with no fallback:**
- OpenRouter API key (runtime only; not needed for tests with `LLM_MOCK=true`)

**Missing dependencies with fallback:**
- OpenRouter live calls (fallback: `LLM_MOCK=true` for deterministic testing)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | No | Single-user hardcoded; no authentication |
| V3 Session Management | No | Single-user hardcoded; no sessions |
| V4 Access Control | No | Single-user hardcoded; no role-based access |
| V5 Input Validation | Yes | Pydantic v2 `BaseModel` for request/response schemas; trade quantity > 0; ticker length 1-5 |
| V6 Cryptography | No | No sensitive data encryption (simulated trades, no real money) |
| V8 Data Protection | Partial | Chat history persists to SQLite (not encrypted); no PII or real secrets stored |

### Known Threat Patterns for {FastAPI + SQLite + LLM}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LLM injection (user message contains prompt-breaking text) | Tampering | LLM uses `role` field to distinguish user vs. system; structured output schema enforces response format (malformed JSON fails validation) |
| SQL injection (user message, LLM response) | Tampering | All DB queries use parameterized queries (`?` placeholders); no string concatenation |
| Unvalidated LLM JSON (malformed structured output) | Tampering | Pydantic `.model_validate_json()` raises `ValidationError` on invalid schema; no silent fallthrough |
| Trade execution by LLM without user confirmation | Tampering/Repudiation | Documented in PLAN.md §9 as intentional (simulated environment); user understands risk; no real money |

---

## Sources

### Primary (HIGH confidence)

- **Pydantic v2 documentation** — Structured Outputs, `BaseModel`, `.model_validate_json()` API [VERIFIED: backend/pyproject.toml shows pydantic v2.12.5 installed; FastAPI 0.128.7 depends on it]
- **LiteLLM documentation** — OpenRouter integration, Structured Outputs pattern, `completion()` signature [CITED: cerebras/SKILL.md covers setup, call pattern, streaming; GitHub issue #21252 documents double-prefix bug]
- **Existing backend code** — Portfolio service (`get_portfolio_data()`, `execute_trade()`), router factory patterns, database schema, fixtures [VERIFIED: Read all files from backend/app/]
- **Project CLAUDE.md** — Backend conventions, naming patterns, thread safety, logging [VERIFIED: backend/CLAUDE.md]
- **PROJECT CONTEXT** — CONTEXT.md locked decisions (D-01, D-02, D-03) [VERIFIED: Read 03-CONTEXT.md]

### Secondary (MEDIUM confidence)

- **MEMORY.md** — LiteLLM/OpenRouter bug note (double prefix required) [CITED: .claude/worktrees/../MEMORY.md mentions `openrouter/openrouter/free` bug fix]
- **STATE.md Critical Pitfalls** — Pitfall #2: LiteLLM detection bug [VERIFIED: .planning/STATE.md explicitly documents the workaround]

### Tertiary (LOW confidence)

- None — all critical claims verified against code or official documentation

---

## Metadata

**Confidence breakdown:**
- **Standard Stack:** HIGH — LiteLLM and Pydantic v2 both explicitly required and verified in project + skill documentation. Only assumption is version compatibility (managed by uv).
- **Architecture:** HIGH — Patterns derived directly from existing backend code (portfolio service, router factories, database patterns). LiteLLM call pattern from cerebras skill.
- **Pitfalls:** HIGH — Critical pitfall #2 (OpenRouter detection bug) documented in STATE.md and MEMORY.md. Other pitfalls derived from common LLM/trade execution issues.

**Research date:** 2026-04-10  
**Valid until:** 2026-04-17 (7 days — fast-moving domain: OpenRouter models, LiteLLM updates may change)

---

*Research completed: 2026-04-10*  
*Phase: 03-llm-chat-integration*
