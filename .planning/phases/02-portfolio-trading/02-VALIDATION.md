---
phase: 2
slug: portfolio-trading
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-10
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3.0+ with pytest-asyncio |
| **Config file** | `backend/pyproject.toml` (testpaths: `tests`, asyncio_mode: `auto`) |
| **Quick run command** | `uv run --extra dev pytest tests/test_portfolio.py -x` |
| **Full suite command** | `uv run --extra dev pytest tests/ -v --cov=app` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `uv run --extra dev pytest tests/test_portfolio.py -x`
- **After every plan wave:** Run `uv run --extra dev pytest tests/ -v --cov=app`
- **Before `/gsd-verify-work`:** Full suite must be green, coverage > 80%
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | PORT-02 | T-02-01-01 | Pydantic rejects invalid side/quantity | unit | `uv run --extra dev pytest tests/test_portfolio.py::test_trade_buy_success -x` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | PORT-02 | T-02-01-02 | Insufficient cash returns 400 | unit | `uv run --extra dev pytest tests/test_portfolio.py::test_trade_buy_insufficient_cash -x` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | PORT-02 | T-02-01-03 | Insufficient shares returns 400 | unit | `uv run --extra dev pytest tests/test_portfolio.py::test_trade_sell_insufficient_shares -x` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | PORT-02 | — | Atomic rollback on failure | unit | `uv run --extra dev pytest tests/test_portfolio.py::test_trade_atomic_rollback -x` | ✅ | ⬜ pending |
| 2-01-05 | 01 | 1 | PORT-02 | — | Decimal precision throughout | unit | `uv run --extra dev pytest tests/test_portfolio.py::test_decimal_precision -x` | ✅ | ⬜ pending |
| 2-02-01 | 02 | 2 | DATA-05 | — | Snapshot recorded post-trade | unit | `uv run --extra dev pytest tests/test_portfolio.py::test_snapshot_recorded_post_trade -x` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | DATA-05 | — | Background loop records snapshots | unit | `uv run --extra dev pytest tests/test_portfolio.py::test_snapshot_background_loop -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_portfolio.py` — add stubs for: `test_trade_buy_success`, `test_trade_buy_insufficient_cash`, `test_trade_sell_insufficient_shares`, `test_snapshot_recorded_post_trade`, `test_snapshot_background_loop`
- [ ] Existing `test_trade_atomic_rollback` and `test_decimal_precision` are already green — no stubs needed

*Note: conftest.py fixtures from Phase 1 are sufficient — no new fixtures required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Trade persists across DB restart | PORT-02 | Requires process restart | Execute a trade, stop the server, restart, verify position and cash balance are unchanged |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
