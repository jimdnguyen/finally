---
phase: 4
slug: frontend-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + React Testing Library 16.x |
| **Config file** | `frontend/vitest.config.ts` (Wave 0 installs) |
| **Quick run command** | `cd frontend && npm run test -- --run` |
| **Full suite command** | `cd frontend && npm run test -- --run && npm run build` |
| **Estimated runtime** | ~15 seconds (tests) + ~30 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm run test -- --run`
- **After every plan wave:** Run `cd frontend && npm run test -- --run && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green + `out/index.html` must exist
- **Max feedback latency:** ~45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 0 | UI-01, UI-02 | — | N/A | build | `npm run build` → `out/index.html` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 0 | UI-17 | — | N/A | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 1 | UI-15, UI-03 | — | No XSS via SSE data | unit | `PriceStore.test.ts` | ❌ W0 | ⬜ pending |
| 4-02-02 | 02 | 1 | UI-04, UI-06 | — | N/A | unit | `WatchlistRow.test.tsx` | ❌ W0 | ⬜ pending |
| 4-02-03 | 02 | 1 | UI-05 | — | N/A | unit | `PriceFlash.test.tsx` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 1 | UI-07, UI-08 | — | N/A | build | `npm run build` | ❌ W0 | ⬜ pending |
| 4-03-02 | 03 | 1 | UI-09, UI-10 | — | N/A | build | `npm run build` | ❌ W0 | ⬜ pending |
| 4-04-01 | 04 | 1 | UI-11 | — | N/A | build | `npm run build` | ❌ W0 | ⬜ pending |
| 4-04-02 | 04 | 1 | UI-12, UI-16 | — | Input validation (qty > 0, ticker non-empty) | unit | `TradeBar.test.tsx` | ❌ W0 | ⬜ pending |
| 4-05-01 | 05 | 2 | UI-13, UI-14 | — | No XSS via chat content | unit | `ChatPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 4-05-02 | 05 | 2 | WTCH-02, WTCH-03 | — | N/A | unit | `WatchlistRow.test.tsx` | ❌ W0 | ⬜ pending |
| 4-06-01 | 06 | 2 | UI-03, UI-05 | — | N/A | unit | `ConnectionStatus.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/vitest.config.ts` — Vitest config with jsdom, React plugin, path aliases
- [ ] `frontend/__tests__/PriceStore.test.ts` — stub for UI-15 (Zustand store, SSE status)
- [ ] `frontend/__tests__/WatchlistRow.test.tsx` — stub for UI-04, UI-06, WTCH-02, WTCH-03
- [ ] `frontend/__tests__/TradeBar.test.tsx` — stub for UI-12 (validation: empty ticker, zero qty)
- [ ] `frontend/__tests__/ChatPanel.test.tsx` — stub for UI-13, UI-14 (user/assistant messages, loading)
- [ ] `frontend/__tests__/ConnectionStatus.test.tsx` — stub for UI-03, UI-05 (green/yellow/red indicator)
- [ ] `frontend/package.json` — `"test": "vitest"` script added

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Price flash green/red animation | UI-05 | CSS animation timing, visual only | Open app, watch watchlist — green/red flash on price change, fades ~500ms |
| ECharts sparklines render | UI-06 | Canvas rendering, visual only | Open app, confirm sparklines fill progressively |
| ECharts main chart | UI-08 | Canvas rendering, click interaction | Click ticker in watchlist, confirm main chart updates |
| ECharts treemap colors | UI-09 | P&L color correctness, visual | Buy/sell, confirm heatmap colors match profit/loss |
| SSE reconnect indicator | UI-15 | Network interruption, visual | Kill backend, confirm yellow dot; restart, confirm green |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
