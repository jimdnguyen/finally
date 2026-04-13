# Deferred Work

## Deferred from: code review of 1-1-backend-foundation-watchlist-api (2026-04-11)

- Race condition in `init_db()` seeding — two concurrent COUNT=0 checks could race; guarded by UNIQUE constraints + INSERT OR IGNORE; theoretical only in single-process app
- Missing `row_factory` in `init_db()` direct connection — init_db() never reads rows by column name; no functional impact
- No transaction isolation in watchlist handlers — single-user SQLite design; each handler opens its own connection
- Unhandled `SQLITE_BUSY` during init — single-user local SQLite; no realistic lock contention at startup
- Test monkeypatch DB_PATH fragility — DB_PATH patched in 3 modules; 86/86 tests passing; fragility concern if modules are added

## Deferred from: code review of 1-2-frontend-shell-design-system (2026-04-11)

- No `display: 'swap'` on font loaders — FOIT improvement, not breaking; fonts confirmed working
- No minimum viewport width enforced — desktop-first per spec; responsiveness out of scope for this story
- Turbopack active despite `--no-turbopack` init flag — non-functional deviation; build produces correct static output

## Deferred from: code review of 2-2-portfolio-snapshot-background-task (2026-04-12)

- No error handling for DB failures in `snapshot_loop()` — a transient DB error (e.g., locked file) would crash the task permanently. Spec pattern only catches `CancelledError`; defensive handling deferred for MVP.
- Floating-point accumulation in portfolio value sum — native Python `sum()` with no rounding. Pre-existing deferral (F2 from Story 2.1). Acceptable for simulated portfolio.

## Deferred from: code review of 2-7-pnl-history-chart (2026-04-12)

- Race condition: rapid trades may receive out-of-order history responses — pre-existing fire-and-forget pattern in codebase; single-user simulator makes this low impact in practice
- Silent error swallowing in `fetchPortfolioHistory` `.catch(() => {})` — intentional per Dev Notes; consistent with all initial fetch patterns; no user-visible history loading error
- ResizeObserver null-ref edge case on rapid unmount in PnLHistoryChart — same pattern as MainChart.tsx reference implementation; cleanup ordering (disconnect then remove) prevents in practice
- Client-side data ordering not validated before `setData` — spec guarantees backend returns history sorted ascending; defensive sort deferred
- TabStrip keyboard accessibility (aria-selected, role="tab", arrow key navigation) — legitimate enhancement; not required by AC4; suitable for a future accessibility pass
