# Phase 3: LLM Chat Integration - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement `POST /api/chat` — a backend endpoint that receives a user message, builds
LLM call context (portfolio + history), calls OpenRouter/Cerebras via LiteLLM with
structured output, auto-executes any validated trades and watchlist changes from the
response, persists the exchange to `chat_messages`, and returns the full structured
response to the caller.

No frontend work in this phase. No streaming. No tool-calling. Structured output only.

</domain>

<decisions>
## Implementation Decisions

### Portfolio Context Injection

- **D-01:** Inject **full portfolio context** into the LLM system prompt on every call — cash
  balance, all positions (ticker, qty, avg cost, current price, unrealized P&L), total
  portfolio value, and watchlist tickers with live prices. Rebuild this block fresh from
  `get_portfolio_data()` and `get_price_cache()` on every request.

- **D-02:** Format as **structured prose** — human-readable paragraph/sentence format, not JSON
  and not a markdown table. Example style:
  ```
  Your portfolio: $8,234 cash. Positions: AAPL 10 shares, avg cost $185.00,
  current $192.40 (+$74.00 unrealized). Total value: $9,158.00.
  Watchlist: AAPL $192.40, TSLA $248.10, NVDA $875.50 ...
  ```

- **D-03:** Inject into the **system prompt on every call** (not the user message prefix, not
  once at conversation start). This ensures the LLM always has current data regardless
  of how many trades have executed mid-conversation.

### Claude's Discretion

The following areas were not discussed — Claude has full flexibility:

- **History window:** Load last N turns from `chat_messages` (recommend 10–20 messages to
  balance context richness vs. token cost). Exclude the current request when loading history.
- **Partial trade failure handling:** When LLM requests multiple trades and one fails
  validation, continue executing the remaining valid trades and report each failure inline
  in the response (continue-and-report, not abort-all).
- **Mock response design:** `LLM_MOCK=true` returns a deterministic hardcoded response with
  a friendly message and one sample buy trade (e.g., buy 1 AAPL) so Phase 4 frontend
  integration has a realistic non-empty response to render.
- **Chat module structure:** Organize as `backend/app/chat/` following the same pattern as
  `backend/app/portfolio/` (models.py, service.py, router.py + `__init__.py`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### LLM Integration
- `.claude/skills/cerebras/SKILL.md` — Model string (`openrouter/openrouter/free`), `extra_body`
  for Cerebras routing, Structured Outputs pattern, streaming behavior notes. This is
  the authoritative skill reference for all LiteLLM calls in this project.

### Backend Patterns
- `backend/app/portfolio/models.py` — Pydantic v2 model conventions; use same style for
  `ChatRequest` / `ChatResponse` schemas.
- `backend/app/portfolio/service.py` — `get_portfolio_data()` returns current portfolio
  state; reuse directly for context injection.
- `backend/app/portfolio/routes.py` — Router factory pattern (`create_portfolio_router()`);
  use same factory pattern for `create_chat_router()`.
- `backend/app/dependencies.py` — `get_db` and `get_price_cache` FastAPI deps; reuse for
  chat endpoint.
- `backend/app/main.py` — Wire chat router here in same pattern as portfolio/watchlist
  routers.

### Requirements
- `.planning/REQUIREMENTS.md` §Chat & LLM Integration — CHAT-01 through CHAT-06 are the
  authoritative acceptance criteria.
- `.planning/STATE.md` §Critical Pitfalls — Pitfall #2: LiteLLM OpenRouter detection
  (`litellm._openrouter_force_structured_output = True` must be set before calling).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/portfolio/service.py: get_portfolio_data()` — Returns `PortfolioResponse`
  with positions + cash + total_value + live prices; call this to build context block.
- `backend/app/dependencies.py: get_db, get_price_cache` — FastAPI DI helpers ready to use.
- `backend/app/portfolio/service.py: execute_trade()` — Async trade execution with full
  validation; call this for each LLM-requested trade in the auto-execution loop.
- `backend/app/watchlist/` — Watchlist CRUD; check what's available for LLM-requested
  watchlist_changes auto-execution.

### Established Patterns
- **Router factory:** `create_X_router()` returns an `APIRouter` with prefix baked in;
  mount in `main.py` with `app.include_router(...)`.
- **Pydantic v2 models:** Flat `BaseModel` subclasses with `Field(...)` and docstrings in
  `models.py`; no ORM, no nesting except where natural.
- **Service layer:** Pure functions in `service.py` that take `db + price_cache` — no
  FastAPI dependencies at the service level.
- **Thread-pool for sync DB:** `run_in_threadpool()` wraps synchronous sqlite3 calls.

### Integration Points
- Wire `create_chat_router()` in `backend/app/main.py` (after portfolio and watchlist routers).
- `chat_messages` table already defined in schema (role, content, actions JSON, user_id).
- Auto-executing trades calls the same `execute_trade()` used by manual `POST /api/portfolio/trade`.

</code_context>

<specifics>
## Specific Ideas

- System prompt persona: "FinAlly, an AI trading assistant" — keep responses concise and
  data-driven per PLAN.md §9.
- The prose context block should read naturally — avoid CSV-style dumps. Write it as if
  briefing a human analyst: cash first, then positions by value descending, then watchlist.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-llm-chat-integration*
*Context gathered: 2026-04-10*
