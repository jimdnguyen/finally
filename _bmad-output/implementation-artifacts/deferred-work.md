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

## Deferred from: code review of 3-1-chat-api-with-portfolio-context (2026-04-12)

- No API key pre-validation before LLM call (`service.py:42`) — broad `except` catches the failure and returns 502 LLM_ERROR; environment config concern out of story scope
- Messages saved after trades execute (`service.py:153`) — if `save_message` fails, trades are orphaned with no audit trail; known SQLite single-user trade-off
- No timeout on `litellm.acompletion()` (`service.py:42`) — frontend loading indicator is the current mitigation; server-side timeout is future hardening
- `price_cache.get_price(ticker) or avg_cost` falsely falls back on zero price (`service.py:74`) — zero price is unrealistic for equities in this simulator; no practical impact
- Empty LLM message string passes `LLMResponse` validation (`models.py:20`) — minor UX concern; spec does not require `min_length` on the LLM response message field

## Deferred from: code review of 4-3-playwright-e2e-tests (2026-04-13)

- StatusDot color→visibility check (`test/specs/00-fresh-start.spec.ts:21`) — Firefox headless SSE unreliable; test verifies component visibility instead of green class
- dispatchEvent workaround for hover-revealed buttons (`test/specs/watchlist.spec.ts:24`) — CSS hover states don't work in headless Firefox; functionally equivalent
- Security flags disabled (`test/playwright.config.ts:15-21`) — --no-sandbox, --disable-web-security required for Docker Desktop Windows; document as platform limitation
- No test data reset between tests (`test/specs/*.spec.ts`) — serial execution (workers:1) with fresh DB per run; acceptable for E2E isolation
- networkidle race with slow container startup (`test/specs/*.spec.ts`) — low probability flakiness; would manifest as intermittent test failures
