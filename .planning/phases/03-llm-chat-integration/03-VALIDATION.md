---
phase: 3
slug: llm-chat-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3.0+ |
| **Config file** | `backend/pyproject.toml` (asyncio_mode="auto") |
| **Quick run command** | `cd backend && uv run --extra dev pytest tests/chat/ -x` |
| **Full suite command** | `cd backend && uv run --extra dev pytest tests/ --cov=app` |
| **Estimated runtime** | ~10 seconds (quick), ~30 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && uv run --extra dev pytest tests/chat/ -x`
- **After every plan wave:** Run `cd backend && uv run --extra dev pytest tests/ --cov=app`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | CHAT-02 | — | N/A | unit | `cd backend && uv run --extra dev pytest tests/chat/test_models.py::test_chat_response_validation -xvs` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | CHAT-04 | — | N/A | unit | `cd backend && uv run --extra dev pytest tests/chat/test_service.py::test_mock_mode_deterministic -xvs` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 1 | CHAT-06 | — | LiteLLM flag set before completion() | integration | Manual + E2E Phase 5 | — | ⬜ pending |
| 3-02-01 | 02 | 2 | CHAT-01 | — | N/A | integration | `cd backend && uv run --extra dev pytest tests/chat/test_routes.py::test_chat_endpoint_structure -xvs` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 2 | CHAT-03 | — | Trade validation re-used | integration | `cd backend && uv run --extra dev pytest tests/chat/test_service.py::test_execute_llm_actions_partial_failure -xvs` | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 2 | CHAT-05 | — | N/A | integration | `cd backend && uv run --extra dev pytest tests/chat/test_service.py::test_save_chat_message -xvs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/chat/__init__.py` — test package initialization
- [ ] `tests/chat/test_models.py` — ChatResponse schema validation, malformed JSON handling
- [ ] `tests/chat/test_service.py` — build_context_block, execute_llm_actions, save_chat_message, mock mode
- [ ] `tests/chat/test_routes.py` — POST /api/chat endpoint structure, integration with portfolio service
- [ ] `tests/conftest.py` — add litellm mock fixtures for deterministic testing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `litellm._openrouter_force_structured_output = True` prevents 502 | CHAT-06 | Requires live OpenRouter call | Run server, POST /api/chat with real OPENROUTER_API_KEY, confirm non-502 response |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
