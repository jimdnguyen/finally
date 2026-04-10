---
phase: 5
slug: docker-e2e-testing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3+ (backend unit), Playwright (E2E) |
| **Config file** | `backend/pyproject.toml` (pytest config), `test/playwright.config.ts` |
| **Quick run command** | `cd backend && uv run pytest tests/ -q --tb=short` |
| **Full suite command** | `cd backend && uv run pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds (unit), ~120 seconds (E2E with Docker) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && uv run pytest tests/ -q --tb=short`
- **After every plan wave:** Run `cd backend && uv run pytest tests/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds (unit tests)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | INFRA-01 | — | N/A | build | `docker build -t finally . && echo OK` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | INFRA-02 | — | N/A | integration | `curl -s http://localhost:8000/api/health` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | TEST-01 | — | N/A | unit | `cd backend && uv run pytest tests/portfolio/ -q` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 1 | TEST-02 | — | N/A | unit | `cd backend && uv run pytest tests/chat/ -q` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 2 | TEST-03 | — | N/A | e2e | `docker compose -f test/docker-compose.test.yml run --rm playwright` | ❌ W0 | ⬜ pending |
| 5-04-01 | 04 | 2 | INFRA-04 | — | N/A | manual | `bash scripts/start_mac.sh && bash scripts/stop_mac.sh` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/portfolio/test_trade_execution.py` — stubs for TEST-01 trade execution edge cases
- [ ] `backend/tests/chat/test_chat_parsing.py` — stubs for TEST-02 LLM parsing edge cases
- [ ] `test/playwright.config.ts` — Playwright config for TEST-03 E2E tests
- [ ] `test/docker-compose.test.yml` — Docker Compose for E2E test environment

*Existing infrastructure in `backend/tests/conftest.py` covers shared fixtures.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Docker image builds successfully | INFRA-01 | Docker daemon required, not available in CI unit test | `docker build -t finally .` → exits 0 |
| Start/stop scripts idempotent | INFRA-04 | Requires Docker daemon + shell environment | Run `scripts/start_mac.sh` twice; verify no errors on second run |
| Database persists across container restart | INFRA-02 | Requires live container + volume | Buy shares, stop container, restart, verify positions still exist |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
