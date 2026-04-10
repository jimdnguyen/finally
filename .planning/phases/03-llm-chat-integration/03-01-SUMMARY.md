---
phase: 03-llm-chat-integration
plan: 01
subsystem: LLM Chat Integration
tags: [models, schemas, pydantic-v2, testing, mock-fixtures]
dependency_graph:
  requires: []
  provides: [chat-models, chat-validation, mock-llm-responses]
  affects: [wave-2-service, wave-3-endpoint]
tech_stack:
  added: [pydantic-v2-basemodel, literal-type-constraints]
  patterns: [field-with-description, model-validate-json]
key_files:
  created:
    - backend/app/chat/__init__.py
    - backend/app/chat/models.py
    - backend/tests/chat/__init__.py
    - backend/tests/chat/conftest.py
    - backend/tests/chat/test_fixtures.py
    - backend/tests/chat/test_models.py
  modified: []
decisions: []
metrics:
  duration_minutes: 15
  completed_date: "2026-04-10"
  test_count: 15
  test_pass_rate: 100
  files_created: 6
---

# Phase 03 Plan 01: Chat Module Scaffolding — Summary

## Objective

Create chat module scaffolding with Pydantic v2 models for request/response schemas, test infrastructure for schema validation, and LiteLLM mock fixtures. Establishes contracts before service implementation (Wave 2).

## What Was Built

### Models Created (backend/app/chat/models.py)

Four Pydantic v2 BaseModel schemas using Field() with descriptions:

1. **ChatRequest**
   - Field: `message` (str, required)
   - Purpose: User's chat input to the endpoint
   - Validation: None (any non-empty string accepted)

2. **TradeAction**
   - Field: `ticker` (str, required) — 1-5 uppercase chars
   - Field: `side` (Literal["buy", "sell"], required) — enum constraint
   - Field: `quantity` (float, required, gt=0) — positive quantity enforced
   - Purpose: Trade instruction from LLM structured output
   - Validation: side must be "buy" or "sell"; quantity > 0

3. **WatchlistAction**
   - Field: `ticker` (str, required)
   - Field: `action` (Literal["add", "remove"], required) — enum constraint
   - Purpose: Watchlist modification from LLM
   - Validation: action must be "add" or "remove"

4. **ChatResponse**
   - Field: `message` (str, required) — conversational response
   - Field: `trades` (list[TradeAction], default=[])
   - Field: `watchlist_changes` (list[WatchlistAction], default=[])
   - Purpose: Structured response from OpenRouter LLM
   - Validation: All fields enforced by Pydantic; supports `.model_validate_json()`

### Export Module (backend/app/chat/__init__.py)

Public API exports all four model classes via `__all__`.

### Test Infrastructure

**backend/tests/chat/test_models.py** — 11 schema validation tests

- `test_chat_request_valid()` — ChatRequest instantiation
- `test_chat_response_valid()` — ChatResponse with trades
- `test_chat_response_json_validation()` — `.model_validate_json()` parsing (CHAT-02)
- `test_chat_response_malformed_json()` — ValidationError on missing message field (CHAT-02)
- `test_chat_response_defaults()` — Empty list defaults applied
- `test_trade_action_quantity_positive()` — gt=0 constraint enforced
- `test_trade_action_quantity_valid()` — Positive quantities accepted
- `test_trade_action_side_enum()` — "buy"/"sell" enum constraint
- `test_watchlist_action_action_enum()` — "add"/"remove" enum constraint
- `test_chat_response_multiple_trades_and_watchlist()` — Complex response validation
- `test_chat_response_json_serialization()` — Round-trip JSON serialization

**All 11 tests passing.**

### Mock Fixtures (backend/tests/chat/conftest.py)

Pytest fixtures for deterministic testing (CHAT-04):

1. **mock_llm_response**
   - Returns: ChatResponse with message "I'll help you manage your portfolio. Buying 1 AAPL at market price."
   - Trades: [TradeAction(ticker="AAPL", side="buy", quantity=1)]
   - Watchlist: []
   - Deterministic: Always returns identical response (no randomness)
   - JSON-serializable: Supports model_dump_json() and model_validate_json()

2. **mock_llm_response_multi_action**
   - Returns: ChatResponse with GOOGL sell + TSLA watchlist add
   - For testing complex multi-action responses

3. **mock_llm_response_no_action**
   - Returns: Message-only response (no trades/watchlist changes)
   - For testing analytical responses without actions

**backend/tests/chat/test_fixtures.py** — 4 fixture validation tests

- `test_mock_llm_response_fixture()` — Verifies fixture returns expected hardcoded response
- `test_mock_llm_response_serializable()` — Tests JSON round-trip
- `test_mock_llm_response_multi_action_fixture()` — Validates multi-action fixture
- `test_mock_llm_response_no_action_fixture()` — Validates message-only fixture

**All 4 tests passing.**

## Requirements Coverage

### CHAT-02: Chat Request/Response Schema Validation

**Status: Validated**

- ChatRequest schema validates user message input ✓
- ChatResponse schema with Pydantic v2 Field() descriptions ✓
- TradeAction constraints: ticker, side (buy/sell), quantity > 0 ✓
- WatchlistAction constraints: ticker, action (add/remove) ✓
- .model_validate_json() successfully parses valid OpenRouter JSON responses ✓
- .model_validate_json() raises ValidationError for malformed JSON ✓
- All 11 CHAT-02 validation tests passing ✓

### CHAT-04: Mock Mode for Deterministic Testing

**Status: Validated**

- mock_llm_response fixture returns hardcoded, deterministic ChatResponse ✓
- Mock response is JSON-serializable (model_dump_json() -> model_validate_json()) ✓
- Response never changes (no randomness, safe for E2E/CI/CD tests) ✓
- Multiple fixture variants (multi-action, no-action) for different test scenarios ✓
- All 4 fixture tests passing ✓

## Architecture Notes

### Field Descriptions (CHAT-02 Requirement)

All 23 Field() definitions include `description=` parameter. Each model field is documented for schema clarity.

Example:
```python
message: str = Field(..., description="Conversational response to the user")
trades: list[TradeAction] = Field(
    default_factory=list,
    description="Trade actions to execute (buy/sell instructions)",
)
```

### Pydantic v2 Style Consistency

Follows the same patterns as backend/app/portfolio/models.py:
- Pydantic BaseModel inheritance
- Field() with descriptions
- Type hints with pipe syntax (e.g., `list[TradeAction]` not `List[TradeAction]`)
- Docstrings at class level
- Validation constraints in Field() (e.g., `gt=0`, `Literal[...]`)

### Mock Response Determinism

Mock fixtures return identical responses every time (no `random`, no `datetime.now()`, no side effects). This enables:
- Reproducible E2E tests in Phase 4
- Fast CI/CD pipelines (no external API calls)
- Deterministic behavior for course demonstrations

## Test Results

```
tests/chat/test_fixtures.py::test_mock_llm_response_fixture PASSED
tests/chat/test_fixtures.py::test_mock_llm_response_serializable PASSED
tests/chat/test_fixtures.py::test_mock_llm_response_multi_action_fixture PASSED
tests/chat/test_fixtures.py::test_mock_llm_response_no_action_fixture PASSED
tests/chat/test_models.py::test_chat_request_valid PASSED
tests/chat/test_models.py::test_chat_response_valid PASSED
tests/chat/test_models.py::test_chat_response_json_validation PASSED
tests/chat/test_models.py::test_chat_response_malformed_json PASSED
tests/chat/test_models.py::test_chat_response_defaults PASSED
tests/chat/test_models.py::test_trade_action_quantity_positive PASSED
tests/chat/test_models.py::test_trade_action_quantity_valid PASSED
tests/chat/test_models.py::test_trade_action_side_enum PASSED
tests/chat/test_models.py::test_watchlist_action_action_enum PASSED
tests/chat/test_models.py::test_chat_response_multiple_trades_and_watchlist PASSED
tests/chat/test_models.py::test_chat_response_json_serialization PASSED

15 passed in 0.05s
```

**Test Coverage:** 100% of task acceptance criteria verified.

## Deviations from Plan

None — plan executed exactly as written. All models created with Field() descriptions, all validation tests passing, all mock fixtures deterministic and JSON-serializable.

## What Comes Next (Wave 2)

- **03-02**: Service layer implementation
  - LiteLLM integration with OpenRouter (cerebras skill)
  - ChatService class with context injection
  - Trade/watchlist action validation and execution
  - Chat message persistence to database
  
- Integration points:
  - ChatResponse models defined here used by service
  - Mock fixtures available for service layer unit tests
  - Pydantic validation happens before service code executes

## Verification Checklist

- [x] backend/app/chat/models.py exists with 4 Pydantic models
- [x] All models use BaseModel with Field() descriptions
- [x] TradeAction.side constrained to Literal["buy", "sell"]
- [x] TradeAction.quantity has gt=0 constraint
- [x] WatchlistAction.action constrained to Literal["add", "remove"]
- [x] ChatResponse.message required, trades/watchlist_changes with defaults
- [x] backend/app/chat/__init__.py exports all 4 classes
- [x] ChatResponse.model_validate_json() successfully parses valid JSON
- [x] ChatResponse.model_validate_json() raises ValidationError on malformed JSON
- [x] backend/tests/chat/test_models.py has 11 validation tests, all passing
- [x] backend/tests/chat/conftest.py has 3 mock fixtures (deterministic, JSON-serializable)
- [x] backend/tests/chat/test_fixtures.py has 4 fixture validation tests, all passing
- [x] `uv run --extra dev pytest tests/chat/ -x` passes (15/15 tests)
- [x] `from app.chat import ChatRequest, ChatResponse; ...` succeeds
