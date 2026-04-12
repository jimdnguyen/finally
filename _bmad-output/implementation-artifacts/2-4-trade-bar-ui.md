# Story 2.4: Trade Bar UI

Status: done

## Story

As a **user who wants to execute trades**,
I want **a trade bar with ticker and quantity inputs plus buy/sell buttons**,
so that **I can place market orders instantly from the UI**.

## Acceptance Criteria

1. **Given** the `TradeBar` renders, **when** inspecting its inputs, **then** both ticker and quantity fields use flat border-bottom style only (`border: none; border-bottom: 1px solid var(--border); background: transparent`), no border-radius, focus state changes border-bottom to `blue-primary`.
2. **Given** a user clicks a watchlist row, **when** `selectedTicker` updates in the store, **then** the `TradeBar` ticker input pre-fills with that ticker symbol automatically.
3. **Given** a user fills in ticker + quantity and clicks Buy or Sell, **when** the request is in flight, **then** both buttons are disabled with 40% opacity and `cursor: not-allowed`.
4. **Given** a buy/sell trade executes successfully, **when** the response returns, **then** `portfolioStore` is refetched from `GET /api/portfolio` (never optimistic update), positions table and header value update immediately — no toast notification.
5. **Given** a trade fails validation (e.g., insufficient cash), **when** the error response arrives, **then** inline red error text appears below the trade bar inputs (persistent until next submit attempt) — no toast notification (UX-DR16, FR29).

## Tasks / Subtasks

- [x] Task 1: Add trade types and API function (AC: 3, 4, 5)
  - [x] 1.1 Add `TradeRequest` type to `frontend/src/types/index.ts`: `{ ticker: string; quantity: number; side: 'buy' | 'sell' }`
  - [x] 1.2 Add `executeTrade(req: TradeRequest): Promise<Portfolio>` to `frontend/src/lib/api.ts` — POST to `/api/portfolio/trade`, returns `Portfolio` on success, throws `ApiError` with `code` field on failure
  - [x] 1.3 Write tests in `frontend/src/lib/api.test.ts`: success returns Portfolio, 400 error throws ApiError with correct code and message

- [x] Task 2: Create `TradeBar` component (AC: 1, 2, 3, 4, 5)
  - [x] 2.1 Create `frontend/src/components/layout/TradeBar.tsx` — `'use client'` component with ticker input, quantity input, Buy button, Sell button, and inline error area
  - [x] 2.2 Implement flat border-bottom input styling per UX-DR10/UX-DR15: `border-b border-border bg-transparent focus:border-b-blue-primary outline-none font-mono` — no `rounded`, no `border` (only bottom), focus changes border-bottom color
  - [x] 2.3 Subscribe to `usePriceStore((s) => s.selectedTicker)` — sync into ticker input as controlled value; user can still type to override
  - [x] 2.4 Buy/Sell buttons: purple background `bg-purple-action text-white uppercase font-sans text-xs font-semibold tracking-wide` with zero border-radius per UX-DR19
  - [x] 2.5 Implement submission: call `executeTrade()`, disable both buttons during flight (40% opacity + `cursor-not-allowed`), clear error on new submit
  - [x] 2.6 On success: call `fetchPortfolio()` then `usePortfolioStore.getState().setPortfolio(result)` to refetch — never optimistic update (ARCH-11); clear quantity input, keep ticker
  - [x] 2.7 On error: display `ApiError.message` as inline red text (`text-red-down text-xs`) below the inputs; persist until next submit attempt
  - [x] 2.8 Keyboard: Enter in quantity field triggers Buy action (most common flow); Tab order: ticker → quantity → Buy → Sell
  - [x] 2.9 Write tests in `frontend/src/components/layout/TradeBar.test.tsx`:
    - Renders ticker input, quantity input, Buy and Sell buttons
    - Ticker input pre-fills from selectedTicker in priceStore
    - Buttons show purple background and uppercase text
    - Buttons disabled during submission (opacity and cursor)
    - Successful trade calls executeTrade and refetches portfolio
    - Failed trade shows inline error text in red
    - Error clears on next submit attempt
    - Enter key in quantity field triggers buy

- [x] Task 3: Wire `TradeBar` into `CenterPanel` (AC: 1)
  - [x] 3.1 Modify `frontend/src/components/layout/CenterPanel.tsx` — add `TradeBar` between `MainChart` and `PositionsTable`
  - [x] 3.2 TradeBar sits in a fixed-height container with top/bottom borders: `border-t border-b border-border`
  - [x] 3.3 Update `CenterPanel.test.tsx` to verify TradeBar renders

- [x] Task 4: Full regression test run
  - [x] 4.1 Run ALL frontend tests — existing + new must pass
  - [x] 4.2 Run ALL backend tests (`uv run --extra dev pytest -v`) — ensure no regressions

## Dev Notes

### Architecture Compliance

**Component location**: `frontend/src/components/layout/TradeBar.tsx` — all layout components live in `components/layout/` (established pattern: WatchlistPanel, WatchlistRow, CenterPanel, MainChart, Header, ChatPanel, PositionsTable, StatusDot, SparklineChart).

**NOTE**: The architecture doc suggests `components/Trade/TradeBar.tsx` but the codebase uses a flat `components/layout/` structure. **Follow the codebase**, not the architecture doc.

**Client component**: TradeBar needs `'use client'` — subscribes to Zustand store and handles user interaction.

**ARCH-10 — API routing**: All API calls through `src/lib/api.ts`. The `executeTrade` function must be added there — no inline `fetch()` in TradeBar.

**ARCH-11 — Post-trade refetch**: After successful trade, refetch portfolio from `GET /api/portfolio` and set into `portfolioStore`. Never optimistically update. This is the same pattern used throughout the app.

### Backend API Contract (Already Implemented)

The trade endpoint is fully implemented in `backend/app/portfolio/router.py`:

```
POST /api/portfolio/trade
Request:  { "ticker": "AAPL", "quantity": 10, "side": "buy" }
Response: PortfolioResponse (same shape as GET /api/portfolio)
          { cash_balance, positions: [...], total_value }

Error 400: { "error": "Insufficient cash", "code": "INSUFFICIENT_CASH" }
           { "error": "Insufficient shares", "code": "INSUFFICIENT_SHARES" }
           { "error": "No price available for AAPL", "code": "NO_PRICE" }
```

**Important**: The backend upper-cases and strips the ticker (`body.ticker.upper().strip()`), so the frontend can send as-is. Quantity must be `> 0` (Pydantic `Field(gt=0)`).

**Response is a full PortfolioResponse** — after `executeTrade()`, you can set the response directly into `portfolioStore` instead of making a separate `fetchPortfolio()` call. This is NOT optimistic update — the response comes from the server with confirmed post-trade state.

### Input Styling (UX-DR10, UX-DR15)

All form inputs use flat border-bottom only:

```
CSS concept:
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  font-family: JetBrains Mono;

Tailwind equivalent:
  border-0 border-b border-border bg-transparent font-mono outline-none
  Focus: focus:border-b-blue-primary
```

Placeholder text: muted color, brief — `"AAPL"` for ticker, `"100"` for quantity.

### Button Styling (UX-DR19)

Buy and Sell buttons share identical styling — purple primary action:

```
Tailwind:
  bg-purple-action text-white uppercase text-xs font-semibold font-sans tracking-wide
  px-4 py-1.5 (compact for trade bar context)

Disabled state:
  disabled:opacity-40 disabled:cursor-not-allowed
```

**Zero border-radius** — no `rounded` class. This is explicit in UX-DR19.

### Feedback Pattern (UX-DR16)

- **Success**: No toast, no notification. The portfolio panels (Header value, PositionsTable) update automatically when `portfolioStore` is refreshed. The result is self-evident.
- **Error**: Inline red text below the trade bar inputs. Uses `text-red-down text-xs`. Persistent until the user's next submit attempt clears it.

### Ticker Pre-fill Pattern

The `selectedTicker` already lives in `priceStore` (set by `WatchlistRow.onClick`). TradeBar subscribes to it:

```typescript
const selectedTicker = usePriceStore((s) => s.selectedTicker)
```

Use it as the controlled value for the ticker input. When the user types, update local state. When `selectedTicker` changes (watchlist click), sync it to local state via `useEffect`.

### Existing Code to Reuse (DO NOT reinvent)

- `ApiError` class (`lib/api.ts:3-10`) — already has `code` field, thrown by `apiFetch` on non-OK responses
- `apiFetch<T>()` helper (`lib/api.ts:12-19`) — generic typed fetch with error handling
- `fetchPortfolio()` (`lib/api.ts:25-27`) — already exists for refetch pattern
- `usePortfolioStore` (`stores/portfolioStore.ts`) — `setPortfolio()` action for updating after trade
- `usePriceStore` (`stores/priceStore.ts`) — `selectedTicker` for pre-fill
- Design tokens in `globals.css`: `text-red-down`, `bg-purple-action`, `border-border`, `border-blue-primary`, `text-text-muted`
- Font variables: `font-mono` (JetBrains Mono), `font-sans` (Inter)

### ApiError Shape (from existing api.ts)

```typescript
// Current error parsing in apiFetch:
const body = await res.json().catch(() => ({ message: res.statusText, code: String(res.status) }))
throw new ApiError(body.message ?? res.statusText, body.code ?? String(res.status))
```

**WARNING**: The backend sends `{ "error": "...", "code": "..." }` but `apiFetch` reads `body.message`. This means `ApiError.message` will be `res.statusText` (e.g., "Bad Request"), not the descriptive error. Fix `apiFetch` to also check `body.error`:

```typescript
throw new ApiError(body.error ?? body.message ?? res.statusText, body.code ?? String(res.status))
```

This fix is critical for AC 5 — the inline error text needs the descriptive message like "Insufficient cash", not "Bad Request".

### Testing Pattern (from previous stories)

Frontend tests use Vitest + React Testing Library:
- Co-located: `TradeBar.test.tsx` alongside `TradeBar.tsx`
- Mock Zustand stores by importing and calling `setState` directly
- Mock API functions with `vi.mock('@/lib/api')`
- For API tests (`api.test.ts`), mock global `fetch` with `vi.fn()`
- See `PositionsTable.test.tsx`, `WatchlistRow.test.tsx`, `Header.test.tsx` for patterns

### CenterPanel Layout Update

Current layout is MainChart (flex-1) + PositionsTable (h-48). Insert TradeBar between them:

```tsx
<section className="flex-1 bg-background overflow-hidden flex flex-col">
  <div className="flex-1 min-h-0">
    <MainChart />
  </div>
  <TradeBar />              {/* NEW — fixed height, self-sizing */}
  <div className="h-48 min-h-[8rem] border-t border-border overflow-auto">
    <PositionsTable />
  </div>
</section>
```

TradeBar should be a compact horizontal bar (single row of inputs + buttons), roughly `h-10` to `h-12`. It manages its own border styling.

### CRITICAL: Read Next.js Docs First

The `frontend/AGENTS.md` warns: *"This is NOT the Next.js you know... Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."* Check for any breaking changes in client components before implementation.

### Project Structure Notes

- `frontend/src/types/index.ts` — MODIFY: Add TradeRequest type
- `frontend/src/lib/api.ts` — MODIFY: Add executeTrade function, fix error field parsing
- `frontend/src/lib/api.test.ts` — NEW: API function tests
- `frontend/src/components/layout/TradeBar.tsx` — NEW: Trade bar component
- `frontend/src/components/layout/TradeBar.test.tsx` — NEW: Trade bar tests
- `frontend/src/components/layout/CenterPanel.tsx` — MODIFY: Add TradeBar between chart and table
- `frontend/src/components/layout/CenterPanel.test.tsx` — MODIFY: Add TradeBar test

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 2.4 acceptance criteria, technical requirements, cross-story dependencies]
- [Source: _bmad-output/planning-artifacts/architecture.md — ARCH-10 API routing, ARCH-11 post-trade refetch, error response envelope, frontend file organization]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — UX-DR10 TradeBar, UX-DR15 flat inputs, UX-DR16 no toasts, UX-DR19 button hierarchy]
- [Source: _bmad-output/implementation-artifacts/2-3-positions-table-portfolio-header.md — previous story intelligence, Zustand selector stability fix]
- [Source: backend/app/portfolio/router.py — POST /api/portfolio/trade contract, error codes]
- [Source: backend/app/portfolio/models.py — TradeRequest Pydantic model, PortfolioResponse shape]
- [Source: frontend/src/lib/api.ts — ApiError class, apiFetch helper, error field mismatch]
- [Source: frontend/src/stores/portfolioStore.ts — setPortfolio action for post-trade update]
- [Source: frontend/src/stores/priceStore.ts — selectedTicker for ticker pre-fill]
- [Source: frontend/src/components/layout/CenterPanel.tsx — current layout structure]
- [Source: frontend/src/components/layout/PositionsTable.tsx — established component pattern, Zustand subscription, test patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered.

### Completion Notes List

- Task 1: Added `TradeRequest` type to `types/index.ts`. Added `executeTrade()` to `api.ts`. Fixed critical `apiFetch` bug — now checks `body.error` before `body.message` so backend error descriptions ("Insufficient cash") propagate correctly instead of generic "Bad Request". 4 API tests written and passing.
- Task 2: Created `TradeBar.tsx` — `'use client'` component with flat border-bottom inputs (UX-DR10/DR15), purple action buttons (UX-DR19), inline red error text (UX-DR16), ticker pre-fill from `selectedTicker` via `useEffect` sync, Enter key triggers Buy, disabled state during flight with 40% opacity. Post-trade: sets server response directly into `portfolioStore` (ARCH-11, not optimistic). 8 component tests written and passing.
- Task 3: Wired `TradeBar` into `CenterPanel` between `MainChart` and `PositionsTable`. Added TradeBar mock and render test to `CenterPanel.test.tsx`. 5 CenterPanel tests passing.
- Task 4: Full regression — 79 frontend tests pass, 130 backend tests pass. Zero regressions.

### Review Findings

- **PATCH (fixed)**: `handleTrade` missing `isSubmitting` guard — rapid Enter key presses could queue multiple trades before React state update. Fixed: added `if (isSubmitting) return` at top of `handleTrade`.
- **DEFER**: `<input type="number">` accepts decimals (e.g., 1.5), backend `Field(gt=0)` rejects non-integers with Pydantic error. Not a bug — backend validates correctly. Future UX improvement: add `step="1"` to input.
- **AC1-AC5**: All pass.

### Change Log

- 2026-04-12: Story 2.4 implemented — TradeBar UI with all ACs satisfied
- 2026-04-12: Code review complete — 1 patch applied (isSubmitting guard), 1 deferred (decimal input)

### File List

- `frontend/src/types/index.ts` — MODIFIED: Added `TradeRequest` interface
- `frontend/src/lib/api.ts` — MODIFIED: Added `executeTrade()`, fixed `apiFetch` error field parsing (`body.error` priority)
- `frontend/src/lib/api.test.ts` — NEW: 4 tests for `executeTrade` and `fetchPortfolio`
- `frontend/src/components/layout/TradeBar.tsx` — NEW: Trade bar component with inputs, buttons, error display
- `frontend/src/components/layout/TradeBar.test.tsx` — NEW: 8 component tests
- `frontend/src/components/layout/CenterPanel.tsx` — MODIFIED: Added `TradeBar` import and placement
- `frontend/src/components/layout/CenterPanel.test.tsx` — MODIFIED: Added TradeBar mock and render test
- `_bmad-output/implementation-artifacts/2-4-trade-bar-ui.md` — MODIFIED: Status → review, tasks checked, dev record
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED: 2-4-trade-bar-ui → review
