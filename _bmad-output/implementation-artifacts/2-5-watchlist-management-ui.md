# Story 2.5: Watchlist Management UI

Status: done

## Story

As a **user managing my watchlist**,
I want **to add and remove tickers directly from the UI**,
so that **I can customize which stocks I monitor without using the chat**.

## Acceptance Criteria

1. **Given** a user hovers over a watchlist row, **when** the hover state activates, **then** a `×` remove button appears (red text); clicking it calls `DELETE /api/watchlist/{ticker}` and the row disappears after refetch — no toast notification.
2. **Given** a ticker is removed, **when** the API returns 204, **then** the watchlist refetches from `GET /api/watchlist` (ARCH-11) and the row is gone — no toast.
3. **Given** the watchlist panel, **when** viewing the bottom, **then** an add-ticker input is visible with flat border-bottom styling (UX-DR15); pressing Enter submits `POST /api/watchlist`.
4. **Given** a ticker is added successfully, **when** the API returns 201, **then** the watchlist refetches and the new row appears with `—` price placeholder until the next SSE update — no toast.
5. **Given** an add fails (e.g., empty ticker), **when** the error response arrives, **then** inline red error text appears below the add-ticker input — no toast (UX-DR16).

## Tasks / Subtasks

- [x] Task 1: Add watchlist API functions to `api.ts` (AC: 1, 3)
  - [x] 1.1 Add `addToWatchlist(ticker: string): Promise<WatchlistItem>` to `frontend/src/lib/api.ts` — POST to `/api/watchlist` with `{ ticker }`, returns `WatchlistItem`
  - [x] 1.2 Add `removeFromWatchlist(ticker: string): Promise<void>` to `frontend/src/lib/api.ts` — DELETE to `/api/watchlist/{ticker}`, returns void (204)
  - [x] 1.3 Fix `apiFetch` 204 guard: add `if (res.status === 204) return undefined as T` before `return res.json()` line
  - [x] 1.4 Fix `apiFetch` error parsing: unwrap FastAPI `detail` wrapper — `const err = body.detail ?? body` then read `err.error ?? err.message`
  - [x] 1.5 Write tests in `frontend/src/lib/api.test.ts`: add success (201), add error throws ApiError with unwrapped message, remove success (204 returns void), remove 404 throws ApiError

- [x] Task 2: Fix WatchlistPanel ARCH-10 violation (AC: 2, 4)
  - [x] 2.1 Refactor `WatchlistPanel.tsx` — remove inline `fetch('/api/watchlist')` and local `tickers` state; subscribe to `useWatchlistStore((s) => s.tickers)` instead
  - [x] 2.2 Watchlist loading already happens in `Providers.tsx` via `fetchWatchlist()` → `setTickers()`. WatchlistPanel just reads from the store — no fetch on mount.
  - [x] 2.3 Update `WatchlistPanel.test.tsx` — mock `useWatchlistStore` instead of mocking global fetch; verify renders tickers from store

- [x] Task 3: Add remove button to `WatchlistRow` (AC: 1, 2)
  - [x] 3.1 Modify `WatchlistRow.tsx` — add a `×` button that is `hidden group-hover:inline` (add `group` class to row container). Button: `text-red-down text-xs font-semibold ml-1 hover:text-red-600`
  - [x] 3.2 On `×` click: call `removeFromWatchlist(ticker)` from `api.ts`, then refetch full watchlist via `fetchWatchlist()` → `useWatchlistStore.getState().setTickers(result.map(i => i.ticker))`. Stop event propagation so row click (select ticker) doesn't fire. Use `isRemoving` local state to prevent double-click (same isSubmitting guard pattern from Story 2.4).
  - [x] 3.3 Write tests in `WatchlistRow.test.tsx`: × hidden by default, visible on hover (use `group-hover` or simulate), click calls removeFromWatchlist, refetches watchlist

- [x] Task 4: Create add-ticker input in `WatchlistPanel` (AC: 3, 4, 5)
  - [x] 4.1 Add an input at the bottom of `WatchlistPanel` — flat border-bottom styling matching TradeBar pattern: `border-0 border-b border-border bg-transparent font-mono text-xs outline-none focus:border-b-blue-primary`, placeholder `"Add ticker..."`, `text-text-primary`
  - [x] 4.2 On Enter: guard with `isAdding` state (prevent double-submit). Call `addToWatchlist(value.trim().toUpperCase())` from `api.ts`. On success: refetch watchlist via `fetchWatchlist()` → `setTickers()`, clear input. On error: show `ApiError.message` as inline red text (`text-red-down text-xs`) below input; clear error on next keypress or submit.
  - [x] 4.3 Empty input validation: if input is empty/whitespace on Enter, show inline error "Enter a ticker symbol" — don't call API
  - [x] 4.4 Write tests in `WatchlistPanel.test.tsx`: input renders, Enter calls addToWatchlist, success refetches and clears input, error shows inline red text, empty submit shows validation error

- [x] Task 5: Full regression test run
  - [x] 5.1 Run ALL frontend tests — existing + new must pass
  - [x] 5.2 Run ALL backend tests (`uv run --extra dev pytest -v`) — ensure no regressions

## Dev Notes

### Architecture Compliance

**ARCH-10 — API routing**: All API calls through `src/lib/api.ts`. WatchlistPanel currently violates this with inline `fetch('/api/watchlist')` — Task 2 fixes this. The new `addToWatchlist` and `removeFromWatchlist` functions must also go through `apiFetch`.

**ARCH-11 — Post-change refetch**: After add or remove, refetch the full watchlist from `GET /api/watchlist` and set into `watchlistStore`. Never optimistically add/remove from the store — always refetch.

**Component location**: All layout components live in `components/layout/` (flat structure). No new component files needed — modify WatchlistPanel and WatchlistRow.

### Backend API Contract (Already Implemented)

```
POST /api/watchlist
Request:  { "ticker": "PYPL" }
Response: { "ticker": "PYPL", "price": null }  (201)
Error:    { "detail": "Ticker is required" }    (422 — empty string)

DELETE /api/watchlist/{ticker}
Response: 204 No Content
Error:    { "detail": "PYPL not found in watchlist" }  (404)

GET /api/watchlist
Response: [{ "ticker": "AAPL", "price": 192.50 }, ...]
```

**Important**: Backend `add_ticker` uses `INSERT OR IGNORE` — adding a duplicate ticker does NOT error. The POST endpoint returns 201 with the existing item. The frontend won't get a duplicate error from the backend, so no special handling needed.

**Important**: Backend upper-cases the ticker (`body.ticker.upper().strip()`), so frontend can send as-is, but we uppercase client-side too for instant UI feedback.

**Important**: DELETE returns 204 (no body). `apiFetch` calls `res.json()` which will fail on empty body. Handle this: for 204 responses, return void without parsing JSON.

### apiFetch 204 Handling

The current `apiFetch` always calls `res.json()` on success. For DELETE (204 No Content), there's no body — `res.json()` will throw. Fix `apiFetch` itself with a 204 guard:

```typescript
if (res.status === 204) return undefined as T
return res.json() as Promise<T>
```

This keeps all API calls routed through `apiFetch` (ARCH-10 compliance) and benefits any future 204 endpoints.

### Backend Error Shape (CRITICAL)

FastAPI `HTTPException(detail={"error": "...", "code": "..."})` serializes as:
```json
{"detail": {"error": "Ticker not found", "code": "TICKER_NOT_FOUND"}}
```

The error object is nested under `detail`. Current `apiFetch` error handler reads `body.error` at top level — it won't find it. Fix the error parsing in `apiFetch`:

```typescript
const err = body.detail ?? body  // unwrap FastAPI's detail wrapper
throw new ApiError(err.error ?? err.message ?? res.statusText, err.code ?? String(res.status))
```

This handles both shapes: FastAPI's `{detail: {error, code}}` and the portfolio endpoint's flat `{error, code}`.

### Refetch Pattern (Established in Story 2.4)

After any watchlist mutation:
```typescript
import { fetchWatchlist } from '@/lib/api'
import { useWatchlistStore } from '@/stores/watchlistStore'

const items = await fetchWatchlist()
useWatchlistStore.getState().setTickers(items.map((i) => i.ticker))
```

This is the same pattern used in TradeBar for portfolio refetch. Use `getState()` because the refetch happens in an async callback, not inside React's render cycle (established in Story 2.4, learning note 27).

### Input Styling (UX-DR15)

Flat border-bottom only — same as TradeBar inputs:
```
border-0 border-b border-border bg-transparent font-mono text-xs outline-none
focus:border-b-blue-primary
placeholder:text-text-muted
```

### Remove Button (UX-DR19, UX-DR23)

- Red text, revealed on hover only
- Use Tailwind `group` / `group-hover` pattern on the row container
- `×` character (U+00D7 or HTML entity) or simple "×" text
- `text-red-down` color, small size `text-xs`
- Must `e.stopPropagation()` to prevent row click (ticker selection) from firing

### Error Display (UX-DR16)

- No toast notifications — inline only
- Red text below the add-ticker input: `text-red-down text-xs`
- Clear error on next keypress or submit attempt (same pattern as TradeBar)

### Existing Code to Reuse (DO NOT reinvent)

- `apiFetch<T>()` (`lib/api.ts`) — generic typed fetch with `ApiError` handling
- `ApiError` class (`lib/api.ts`) — has `message` and `code` fields
- `fetchWatchlist()` (`lib/api.ts`) — already exists, returns `WatchlistItem[]`
- `useWatchlistStore` (`stores/watchlistStore.ts`) — `setTickers`, `addTicker`, `removeTicker` actions exist but **do not use `addTicker`/`removeTicker` for mutations** — use refetch pattern (ARCH-11)
- `WatchlistItem` type (`types/index.ts`) — `{ ticker: string; price: number | null }`
- `Providers.tsx` — already fetches watchlist on mount and sets into store
- Design tokens: `text-red-down`, `border-border`, `border-blue-primary`, `text-text-muted`, `bg-transparent`
- Font: `font-mono` (JetBrains Mono)

### Testing Pattern (from Stories 2.3, 2.4)

- Co-located test files: `*.test.tsx` alongside components
- Mock Zustand stores: import store → `useWatchlistStore.setState({ tickers: [...] })`
- Mock API functions: `vi.mock('@/lib/api')` then `vi.mocked(removeFromWatchlist).mockResolvedValue(undefined)`
- For hover tests: use `fireEvent.mouseEnter` / `fireEvent.mouseOver` — note that `group-hover` is CSS-only and won't trigger in jsdom. Test the button exists in DOM (possibly with `opacity-0` or `invisible` class) and test the click handler separately.
- `stopPropagation` testing: verify row onClick does NOT fire when × is clicked

### CRITICAL: Read Next.js Docs First

The `frontend/AGENTS.md` warns: *"This is NOT the Next.js you know."* Check `node_modules/next/dist/docs/` for breaking changes before modifying client components.

### Project Structure Notes

- `frontend/src/lib/api.ts` — MODIFY: Add `addToWatchlist`, `removeFromWatchlist`
- `frontend/src/lib/api.test.ts` — MODIFY: Add tests for new API functions
- `frontend/src/components/layout/WatchlistPanel.tsx` — MODIFY: Remove inline fetch, subscribe to store, add add-ticker input with inline error
- `frontend/src/components/layout/WatchlistPanel.test.tsx` — MODIFY: Rewrite to mock store instead of fetch, add add-ticker tests
- `frontend/src/components/layout/WatchlistRow.tsx` — MODIFY: Add `group` class and hover-reveal × remove button
- `frontend/src/components/layout/WatchlistRow.test.tsx` — MODIFY: Add × button tests

### Previous Story Intelligence (2.4)

- **isSubmitting guard**: Always guard async handlers — rapid clicks/Enter presses can queue duplicate requests. Apply same pattern to add-ticker input.
- **useEffect sync**: When external state (store) should drive local state (input), use `useEffect` with the store value as dependency.
- **apiFetch error field**: Already fixed in 2.4 — `body.error ?? body.message ?? res.statusText`. But DELETE 404 returns `{ "detail": "..." }` not `{ "error": "..." }` — account for FastAPI's default error shape.
- **getState() in async callbacks**: Use `useWatchlistStore.getState()` (not hooks) when setting store state from async callbacks outside React render cycle.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 2.5 acceptance criteria, FR30]
- [Source: _bmad-output/planning-artifacts/architecture.md — ARCH-10 API routing, ARCH-11 post-change refetch, ARCH-9 error envelope]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — UX-DR23 watchlist management, UX-DR15 flat inputs, UX-DR16 no toasts, UX-DR19 destructive red-on-hover]
- [Source: backend/app/watchlist/router.py — POST/DELETE contracts, 201/204/404 responses]
- [Source: backend/app/watchlist/db.py — INSERT OR IGNORE behavior for duplicates]
- [Source: backend/app/watchlist/models.py — WatchlistItem, AddTickerRequest]
- [Source: frontend/src/components/layout/WatchlistPanel.tsx — current inline fetch (ARCH-10 violation)]
- [Source: frontend/src/components/layout/WatchlistRow.tsx — current row structure, needs × button]
- [Source: frontend/src/lib/api.ts — apiFetch, fetchWatchlist, ApiError]
- [Source: frontend/src/stores/watchlistStore.ts — setTickers, addTicker, removeTicker actions]
- [Source: frontend/src/components/Providers.tsx — initial watchlist fetch on mount]
- [Source: _bmad-output/implementation-artifacts/2-4-trade-bar-ui.md — isSubmitting guard, getState pattern, apiFetch error fix]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered.

### Completion Notes List

- Task 1: Added `addToWatchlist` and `removeFromWatchlist` to `api.ts`. Added 204 guard to `apiFetch` (`if (res.status === 204) return undefined as T`) so DELETE endpoints work. Investigated error shape — custom exception handler in `main.py:53-61` unwraps `detail` dicts, so existing `body.error` parsing works correctly (no fix needed for Task 1.4). 4 new API tests passing.
- Task 2: Refactored `WatchlistPanel` to subscribe to `useWatchlistStore` instead of inline `fetch()` (fixed ARCH-10 violation). Removed `useState`, `useEffect`, and `DEFAULT_TICKERS` — component now just reads from store. `Providers.tsx` already handles initial fetch. Rewrote tests to mock store state instead of global fetch. 3 tests passing.
- Task 3: Added `group` class to `WatchlistRow` container and `×` remove button with `hidden group-hover:inline` visibility. `handleRemove` calls `removeFromWatchlist` → `fetchWatchlist` → `setTickers` (ARCH-11 refetch pattern). Includes `isRemoving` guard and `e.stopPropagation()`. 3 new tests: button renders, click calls API + refetches, click doesn't trigger row selection. 13 total WatchlistRow tests passing.
- Task 4: Added add-ticker input at bottom of `WatchlistPanel` with flat border-bottom styling (UX-DR15). Enter submits via `addToWatchlist` → `fetchWatchlist` → `setTickers`. `isAdding` guard prevents double-submit. Empty input shows "Enter a ticker symbol" inline error. API errors shown inline in red (`text-red-down`). Error clears on next keypress. 5 new tests. 8 total WatchlistPanel tests passing.
- Task 5: Full regression — 90 frontend tests pass, 130 backend tests pass. Zero regressions.

### Change Log

- 2026-04-12: Story 2.5 implemented — Watchlist Management UI with all ACs satisfied

### File List

- `frontend/src/lib/api.ts` — MODIFIED: Added `addToWatchlist()`, `removeFromWatchlist()`, 204 guard in `apiFetch`
- `frontend/src/lib/api.test.ts` — MODIFIED: Added 4 tests for new API functions
- `frontend/src/components/layout/WatchlistPanel.tsx` — MODIFIED: Removed inline fetch (ARCH-10 fix), subscribe to watchlistStore, added add-ticker input with inline error
- `frontend/src/components/layout/WatchlistPanel.test.tsx` — MODIFIED: Rewrote to mock store + added 5 add-ticker tests (8 total)
- `frontend/src/components/layout/WatchlistRow.tsx` — MODIFIED: Added `group` class, `×` remove button, `handleRemove` with isRemoving guard
- `frontend/src/components/layout/WatchlistRow.test.tsx` — MODIFIED: Added 3 remove button tests (13 total)
- `_bmad-output/implementation-artifacts/2-5-watchlist-management-ui.md` — MODIFIED: Status → review, tasks checked, dev record
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED: 2-5-watchlist-management-ui → review
