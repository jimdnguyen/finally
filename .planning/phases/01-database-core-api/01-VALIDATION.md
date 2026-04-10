---
phase: 1
slug: database-core-api
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3.0+ with pytest-asyncio |
| **Config file** | `backend/pyproject.toml` (testpaths: `tests`, asyncio_mode: `auto`) |
| **Quick run command** | `uv run --extra dev pytest tests/test_portfolio.py tests/test_watchlist.py tests/test_health.py -x` |
| **Full suite command** | `uv run --extra dev pytest tests/ -v --cov=app` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `uv run --extra dev pytest tests/test_db.py tests/test_portfolio.py -x`
- **After every plan wave:** Run `uv run --extra dev pytest tests/ -v --cov=app`
- **Before `/gsd-verify-work`:** Full suite must be green, coverage > 80%
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | DATA-01 | — | N/A | unit | `uv run --extra dev pytest tests/test_db.py::test_init_db_creates_schema -x` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | DATA-02 | — | N/A | unit | `uv run --extra dev pytest tests/test_db.py::test_schema_structure -x` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | DATA-03 | — | N/A | unit | `uv run --extra dev pytest tests/test_db.py::test_seed_data -x` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | DATA-04 | — | N/A | unit | `uv run --extra dev pytest tests/test_db.py::test_wal_mode -x` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 2 | PORT-01 | — | N/A | unit | `uv run --extra dev pytest tests/test_portfolio.py::test_get_portfolio -x` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 2 | PORT-03 | — | N/A | unit | `uv run --extra dev pytest tests/test_portfolio.py::test_get_portfolio_history -x` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 2 | PORT-04 | — | N/A | unit | `uv run --extra dev pytest tests/test_portfolio.py::test_trade_atomic_rollback -x` | ❌ W0 | ⬜ pending |
| 1-02-04 | 02 | 2 | DATA-04 | — | Decimal from strings, no float accumulation | unit | `uv run --extra dev pytest tests/test_portfolio.py::test_decimal_precision -x` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 3 | WTCH-01 | — | N/A | unit | `uv run --extra dev pytest tests/test_watchlist.py::test_get_watchlist -x` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 4 | SYS-01 | — | N/A | unit | `uv run --extra dev pytest tests/test_health.py::test_health_check -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_db.py` — stubs for DATA-01, DATA-02, DATA-03, DATA-04
- [ ] `backend/tests/test_portfolio.py` — stubs for PORT-01, PORT-03, PORT-04, DATA-04 (Decimal)
- [ ] `backend/tests/test_watchlist.py` — stubs for WTCH-01
- [ ] `backend/tests/test_health.py` — stub for SYS-01
- [ ] `backend/tests/conftest.py` — shared fixtures: in-memory SQLite DB, FastAPI TestClient, mock PriceCache

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SQLite file persists at `/app/db/finally.db` after container restart | INFRA-03 | Requires Docker volume mount | Run `docker run -v finally-data:/app/db ... finally`, stop, restart, verify data present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
