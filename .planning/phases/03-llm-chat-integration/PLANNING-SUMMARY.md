# Phase 3: LLM Chat Integration — Planning Summary

**Completed:** 2026-04-10  
**Plans Created:** 2 (Wave 1 + Wave 2)  
**Total Tasks:** 7  
**Requirements Addressed:** CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06  
**Decision Coverage:** D-01, D-02, D-03 (all locked decisions fully implemented)

---

## Overview

Phase 3 planning decomposed the LLM chat integration into two executable waves:

| Wave | Plan | Focus | Requirements | Tasks |
|------|------|-------|--------------|-------|
| 1 | 03-01 | Models + Test Scaffolding | CHAT-02, CHAT-04 | 3 |
| 2 | 03-02 | Service + LLM Integration | CHAT-01, CHAT-03, CHAT-05, CHAT-06 | 4 |

**Parallel Execution:** Waves run sequentially (Wave 2 depends on Wave 1 outputs: ChatResponse model, mock fixture).

---

## Wave 1: Chat Models & Test Scaffolding (03-01-PLAN.md)

**Purpose:** Establish contracts before implementation. Define what the LLM must return and what the API accepts/returns.

### Tasks

1. **Task 1: Create chat module package and models.py (CHAT-02, CHAT-04)**
   - Create `backend/app/chat/` package
   - Implement Pydantic v2 models:
     - `ChatRequest`: User message input
     - `ChatResponse`: LLM structured response (message + trades + watchlist_changes)
     - `TradeAction`: Ticker/side/quantity validation (gt=0)
     - `WatchlistAction`: Ticker/action (add|remove) validation
   - Export from `__init__.py`
   - **Verification:** Models instantiate, `.model_validate_json()` parses valid/rejects invalid JSON

2. **Task 2: Create test_models.py with validation tests (CHAT-02)**
   - 6+ pytest tests:
     - `test_chat_response_valid`: Verify schema instantiation
     - `test_chat_response_json_validation`: Verify `.model_validate_json()` deserialization
     - `test_chat_response_malformed_json`: Verify ValidationError on missing fields
     - `test_trade_action_quantity_positive`: Verify gt=0 constraint
     - `test_trade_action_side_enum`: Verify side validation (buy|sell)
     - `test_watchlist_action_action_enum`: Verify action validation (add|remove)
   - **Verification:** All tests pass, schema constraints enforced

3. **Task 3: Create conftest.py with LiteLLM mock fixtures (CHAT-04)**
   - `mock_llm_response()` fixture: Returns deterministic ChatResponse
     - Message: "I'll help you manage your portfolio. Buying 1 AAPL at market price."
     - Trades: `[{"ticker": "AAPL", "side": "buy", "quantity": 1}]`
     - Watchlist_changes: `[]`
   - `mock_completion()` fixture: Mock `litellm.completion()` for service tests
   - **Verification:** Fixtures return identical response every call (deterministic for Phase 4 E2E)

### Deliverables
- `backend/app/chat/models.py` (50+ lines)
- `backend/app/chat/__init__.py` (exports)
- `backend/tests/chat/__init__.py` (test package)
- `backend/tests/chat/test_models.py` (6+ validation tests)
- `backend/tests/chat/conftest.py` (mock fixtures)

### Coverage
- **CHAT-02** (full): ChatResponse schema validates structured JSON via Pydantic
- **CHAT-04** (full): Mock fixtures provide deterministic testing without OpenRouter

---

## Wave 2: Chat Service & LLM Integration (03-02-PLAN.md)

**Purpose:** Implement core chat logic: portfolio context injection, LLM calls with bug fix, auto-execution, persistence.

### Tasks

1. **Task 1: Portfolio context builder + LLM service infrastructure (D-01, D-02, D-03, CHAT-06)**
   - `build_context_block(cursor, price_cache) -> str`:
     - Per D-02: Return prose format (human-readable, NOT JSON/markdown)
     - Per D-03: Build fresh on every request (no caching)
     - Example: "Your portfolio: $10,234 cash. Positions: AAPL 10 shares, avg $185, current $192 (+$70, +3.8%). Total value: $11,451. Watchlist: AAPL $192, TSLA $248, ..."
   
   - `load_conversation_history(cursor, limit=10) -> list[dict]`:
     - Query chat_messages table, last N rows
     - Return in chronological order (oldest first)
     - Format: `[{"role": "user"/"assistant", "content": "..."}]`
   
   - `call_llm_structured(system_prompt, messages, schema) -> ChatResponse`:
     - **CRITICAL (CHAT-06):** Set `litellm._openrouter_force_structured_output = True` BEFORE completion() call
     - Per SKILL.md: Use `model="openrouter/openrouter/free"` (double prefix — bug workaround)
     - Per SKILL.md: Use `extra_body={"provider": {"order": ["cerebras"]}}`
     - Parse response JSON via `schema.model_validate_json()`
     - Raise ValidationError on invalid JSON
   
   - `save_chat_message(cursor, role, content, actions=None) -> str`:
     - Insert into chat_messages: id, user_id='default', role, content, actions (JSON), created_at
     - Return message id
   
   - `execute_llm_actions(db, llm_response, price_cache) -> dict`:
     - **Continue-and-report pattern (CHAT-03):**
       - For each trade: try execute_trade(), on error append to errors[], continue
       - For each watchlist change: try add/remove_watchlist_ticker(), on error append to errors[], continue
       - Return `{"trades": [...], "watchlist_changes": [...], "errors": [...]}`
   
   - `execute_chat_mock() -> ChatResponse`:
     - Per CHAT-04: Return hardcoded mock when `LLM_MOCK=true`
   
   - `execute_chat(db, user_message, price_cache) -> dict`:
     - Orchestrator: checks LLM_MOCK, builds context, loads history, calls LLM, executes actions, saves messages
     - Returns: `{"llm_response": ChatResponse, "executed_actions": dict, "error": str | None}`
     - Wraps DB access with `run_in_threadpool()`

   - **Verification:** Context is prose (not JSON), litellm flag set, mock response deterministic

2. **Task 2: Watchlist service functions (CHAT-03)**
   - `add_watchlist_ticker(db, ticker) -> dict`:
     - Validate: 1-5 alphanumeric, uppercase
     - Insert: id (uuid), user_id='default', ticker, added_at (ISO)
     - Raise HTTPException 400 on duplicate
     - Return: `{"success": True, "ticker": ticker, "action": "added"}`
   
   - `remove_watchlist_ticker(db, ticker) -> dict`:
     - Delete from watchlist
     - Raise HTTPException 400 if not found
     - Return: `{"success": True, "ticker": ticker, "action": "removed"}`

   - **Verification:** CRUD operations work, constraints enforced, errors propagate to execute_llm_actions

3. **Task 3: Chat routes & wire to FastAPI (CHAT-01, CHAT-05)**
   - `create_chat_router() -> APIRouter`:
     - Prefix: `/api/chat`
     - Route: `POST /` accepting ChatRequest, returning ChatResponse
     - Handler: Calls `execute_chat(db, request.message, price_cache)`, returns structured response
   
   - Update `backend/app/main.py`:
     - Import: `from app.chat import create_chat_router`
     - Wire: `app.include_router(create_chat_router())`
   
   - Update `backend/app/chat/__init__.py`:
     - Export: `create_chat_router`

   - **Verification:** Router wired, endpoint accepts requests, returns ChatResponse

4. **Task 4: Integration tests (CHAT-01, CHAT-03, CHAT-05, CHAT-06)**
   - `test_service.py`:
     - `test_build_context_block_prose_format`: Verify context is prose, not JSON/markdown
     - `test_build_context_block_fresh_on_every_call`: Verify D-03 (fresh context per request)
     - `test_load_conversation_history`: Verify history query + chronological order
     - `test_execute_llm_actions_partial_failure`: Verify continue-and-report (one trade fails, others execute)
     - `test_execute_llm_actions_watchlist_changes`: Verify watchlist add/remove auto-execution
     - `test_execute_chat_mock_mode`: Verify CHAT-04 (LLM_MOCK=true returns deterministic response)
     - `test_save_chat_message`: Verify CHAT-05 (messages + actions persisted to DB)
   
   - `test_routes.py`:
     - `test_chat_endpoint_post_structure`: Verify CHAT-01 (POST /api/chat accepts/returns ChatResponse)
     - `test_chat_endpoint_with_mock_llm`: Verify CHAT-04 integration (mock response via endpoint)

   - **Verification:** All tests pass, coverage >80%

### Deliverables
- `backend/app/chat/service.py` (200+ lines)
- `backend/app/chat/routes.py` (50+ lines)
- `backend/app/watchlist/service.py` (40+ lines, new)
- `backend/app/chat/__init__.py` (updated exports)
- `backend/app/main.py` (updated router wiring)
- `backend/tests/chat/test_service.py` (7+ integration tests)
- `backend/tests/chat/test_routes.py` (2+ endpoint tests)

### Coverage
- **CHAT-01** (full): POST /api/chat endpoint with portfolio context + history, returns structured response
- **CHAT-03** (full): Auto-execute validated trades; continue-and-report pattern handles partial failures
- **CHAT-05** (full): Persist messages + executed actions to chat_messages table
- **CHAT-06** (full): LiteLLM `._openrouter_force_structured_output = True` set before every completion() call

---

## Decision Coverage (CONTEXT.md Locked Decisions)

| Decision | Requirement | Implementation | Task | Verification |
|----------|-------------|-----------------|------|--------------|
| **D-01** | Full portfolio context | Call get_portfolio_data() on every request; inject fresh cash + positions + total + watchlist | 03-02 Task 1 | Grep: `build_context_block` calls `get_portfolio_data()` every request |
| **D-02** | Prose format (not JSON) | Return f-string prose: "Your portfolio: ${cash}... Positions: ... Total: ... Watchlist: ..." | 03-02 Task 1 | test_build_context_block_prose_format verifies no JSON/markdown |
| **D-03** | Inject on every call | Rebuild context in execute_chat before every LLM call | 03-02 Task 1 | test_build_context_block_fresh_on_every_call verifies reconstruction |

---

## Threat Model (Security Enforcement: ASVS L1)

| Threat ID | Category | Component | Disposition | Mitigation |
|-----------|----------|-----------|-------------|-----------|
| T-03-01 | Tampering | LLM JSON Response | Mitigate | Pydantic `.model_validate_json()` validates ChatResponse schema; malformed JSON raises ValidationError |
| T-03-02 | Tampering | TradeAction Fields | Mitigate | Field constraints: side ∈ {buy, sell}, quantity > 0, ticker 1-5 chars; enforced at deserialization |
| T-03-03 | Tampering | Trade Execution | Mitigate | Re-use existing execute_trade() validation (sufficient cash/shares); continue-and-report on failures |
| T-03-04 | Information Disclosure | Chat History in DB | Accept | Chat persisted to SQLite (unencrypted); CHAT-05 design; single-user demo, no PII, low risk |
| T-03-05 | Elevation of Privilege | LLM Auto-Execution | Accept | Intentional design (PLAN.md §9); simulated environment with fake money; user understands risk |
| T-03-06 | Information Disclosure | Portfolio Context | Accept | Context string built per-request, not persisted; only sent to LiteLLM (HTTPS); single-user |

---

## Dependency Graph

```
Wave 1 Tasks (03-01):
  1 (models.py) → 2 (test_models.py) → 3 (conftest.py)
  └─ All independent, sequential (each builds on previous)

Wave 2 Tasks (03-02):
  1 (service.py) → 3 (routes.py) → wire main.py
     ↓
     └─→ 2 (watchlist/service.py)
        ↓
        └─→ 4 (integration tests)
```

**Wave 1 → Wave 2 Dependency:** Wave 2 Task 1 imports ChatResponse from Wave 1 Task 1 (models.py)

---

## Execution Notes

### Critical Implementation Details

1. **CHAT-06 Bug Fix (CRITICAL):**
   - Must set `litellm._openrouter_force_structured_output = True` **before each** `completion()` call
   - Double model prefix: `"openrouter/openrouter/free"` (NOT `"openrouter/free"`)
   - LiteLLM GitHub #21252 documents the issue
   - Without this: 502 Bad Gateway from OpenRouter

2. **Prose Context Format (D-02):**
   - Do NOT return JSON object or markdown table
   - Use f-string sentences: "Your portfolio: $X cash. Positions: A Y shares, ... Total value: $Z. Watchlist: ..."
   - Sort positions by value descending
   - Test verifies no `{`, `}`, `|`, or `---` in output

3. **Continue-and-Report Pattern (CHAT-03):**
   - Execute each trade/watchlist change independently
   - Collect errors for failed actions
   - Return all outcomes (success + errors) together
   - Do NOT abort on first failure

4. **Mock Mode (CHAT-04):**
   - Check `os.environ.get("LLM_MOCK") == "true"` at start of execute_chat()
   - Return hardcoded ChatResponse (same every time, no randomness)
   - Message: "I'll help you manage your portfolio. Buying 1 AAPL at market price."
   - No litellm or OpenRouter imports in mock path

5. **Conversation Persistence (CHAT-05):**
   - Save user message to DB **before** LLM call (for continuity)
   - Save assistant response **after** LLM call + auto-execution
   - Store executed_actions as JSON in `actions` column
   - Include both successes and failures in actions

---

## Testing Strategy

### Per-Task Verification
- After 03-01 Task 1: Import and instantiate all models ✓
- After 03-01 Task 2: `cd backend && uv run --extra dev pytest tests/chat/test_models.py -x` ✓
- After 03-01 Task 3: Mock fixtures testable with `cd backend && python3 -c "from tests.chat.conftest import mock_llm_response"` ✓
- After 03-02 Task 1: Service functions importable, context block prose verified ✓
- After 03-02 Task 2: Watchlist CRUD works, constraints enforced ✓
- After 03-02 Task 3: Router wired to app, endpoint responds ✓
- After 03-02 Task 4: `cd backend && uv run --extra dev pytest tests/chat/ -x` (all tests pass) ✓

### Full Suite
```bash
cd backend && uv run --extra dev pytest tests/chat/ -xvs         # Quick (chat tests only)
cd backend && uv run --extra dev pytest tests/ --cov=app         # Full suite + coverage (target >80%)
```

### Manual Verification (CHAT-06)
- Run server with live `OPENROUTER_API_KEY`
- POST to `/api/chat` with test message
- Confirm non-502 response (flag working)
- This happens in Phase 5 E2E tests

---

## Requirement Traceability

| Req ID | Description | Plan | Task | Status |
|--------|-------------|------|------|--------|
| CHAT-01 | POST /api/chat endpoint | 03-02 | Task 3 (routes), Task 4 (test_routes) | ⬜ Planned |
| CHAT-02 | Pydantic schema validation | 03-01 | Task 1 (models), Task 2 (test_models) | ⬜ Planned |
| CHAT-03 | Auto-execute trades (continue-and-report) | 03-02 | Task 1 (execute_llm_actions), Task 4 (test_service) | ⬜ Planned |
| CHAT-04 | LLM_MOCK=true deterministic response | 03-01 | Task 3 (conftest), 03-02 Task 1 (execute_chat_mock), Task 4 (test_service, test_routes) | ⬜ Planned |
| CHAT-05 | Persist messages + actions | 03-02 | Task 1 (save_chat_message), Task 4 (test_service) | ⬜ Planned |
| CHAT-06 | LiteLLM OpenRouter bug fix | 03-02 | Task 1 (call_llm_structured), Task 4 (integration test) | ⬜ Planned |

---

## Next Steps

1. **Execute Phase 3 Planning:**
   ```bash
   /gsd-execute-phase 03
   ```
   - Executor runs Wave 1 (03-01-PLAN.md) first (3 tasks, ~45 min)
   - Then Wave 2 (03-02-PLAN.md) (4 tasks, ~90 min)
   - Total: ~2.5 hours for both waves

2. **Post-Wave 1 Gate:**
   - Verify: `cd backend && uv run --extra dev pytest tests/chat/test_models.py -x` passes
   - All model schemas validated

3. **Post-Wave 2 Gate:**
   - Verify: `cd backend && uv run --extra dev pytest tests/chat/ -xvs` passes (all CHAT-* tests)
   - Verify: Chat endpoint responds to POST requests
   - Verify: Mock mode works (LLM_MOCK=true)

4. **Phase 4 (Frontend):**
   - Can begin once Phase 3 complete
   - All `/api/chat` endpoint and `/api/stream/prices` SSE ready
   - Backend APIs fully functional for frontend integration

---

*Planning completed: 2026-04-10*  
*Phase: 03-llm-chat-integration*  
*Planner: Claude Sonnet 4.6*
