# Story 1.3: Live Price Stream & Zustand Stores

Status: done

## Story

As a user opening the app,
I want prices to stream live from the server and update the UI in real time,
so that the terminal feels alive immediately on page load.

## Acceptance Criteria

1. **Given** the app loads in the browser, **when** `EventSource` connects to `/api/stream/prices`, **then** the `StatusDot` in the header turns green (solid, subtle glow) within 1 second.
2. **Given** the SSE connection is active, **when** a price event arrives, **then** `priceStore` is updated and the corresponding UI element re-renders within 100ms of receipt.
3. **Given** the app loads, **when** `useWatchlistStore` initializes, **then** it fetches `GET /api/watchlist` and populates the store with the 10 default tickers.
4. **Given** the SSE connection drops, **when** `EventSource.onerror` fires, **then** the `StatusDot` turns yellow with a pulsing animation and `EventSource` retries automatically (no user action required).
5. **Given** the SSE connection has been retrying, **when** the connection is restored, **then** the `StatusDot` returns to green and prices resume updating.
6. **Given** repeated reconnection failures, **when** the connection remains down, **then** the `StatusDot` turns red (no animation) and the watchlist shows last-known prices (no blanking or error state).

## Tasks / Subtasks

- [x] Task 1: Define all shared TypeScript types (AC: #2, #3)
  - [x] Replace stub in `frontend/src/types/index.ts` with full type definitions:
    - `PriceUpdate`: `{ ticker: string; price: number; previous_price: number; timestamp: string; direction: 'up' | 'down' | 'flat'; change: number; change_percent: number }`
    - `ConnectionStatus`: `'connected' | 'reconnecting' | 'disconnected'`
    - `WatchlistItem`: `{ ticker: string; price: number | null }`
    - `Position`: `{ ticker: string; quantity: number; avg_cost: number; current_price: number; unrealized_pnl: number; pnl_pct: number }`
    - `Portfolio`: `{ cash_balance: number; positions: Position[]; total_value: number }`
    - `PortfolioSnapshot`: `{ recorded_at: string; total_value: number }`

- [x] Task 2: Implement `priceStore` (AC: #2)
  - [x] Replace stub in `frontend/src/stores/priceStore.ts`
  - [x] Store shape: `{ prices: Record<string, PriceUpdate>; sparklines: Record<string, number[]>; connectionStatus: ConnectionStatus }`
  - [x] Actions: `updatePrice(update: PriceUpdate)` — immutable spread update of prices + append to sparklines buffer capped at 200 points; `setConnectionStatus(status: ConnectionStatus)`
  - [x] Export as `usePriceStore` (Zustand `create` call)
  - [x] Components subscribe to specific tickers using selectors: `usePriceStore(s => s.prices[ticker])` — not the entire store
  - [x] Write tests: `frontend/src/stores/priceStore.test.ts`
    - updatePrice adds entry to prices
    - updatePrice appends to sparkline buffer
    - sparkline buffer is capped at 200 points (add 201 points, verify length === 200)
    - setConnectionStatus updates connectionStatus

- [x] Task 3: Implement `watchlistStore` (AC: #3)
  - [x] Create `frontend/src/stores/watchlistStore.ts` (file does not exist — create new)
  - [x] Store shape: `{ tickers: string[]; isLoading: boolean }`
  - [x] Actions: `setTickers(tickers: string[])`, `addTicker(ticker: string)`, `removeTicker(ticker: string)`, `setLoading(loading: boolean)`
  - [x] Export as `useWatchlistStore`
  - [x] Write tests: `frontend/src/stores/watchlistStore.test.ts`
    - setTickers populates tickers array
    - addTicker appends unique ticker
    - removeTicker removes by value

- [x] Task 4: Implement `portfolioStore` (AC: #2 — store ready for Story 2.3)
  - [x] Replace stub in `frontend/src/stores/portfolioStore.ts`
  - [x] Store shape: `{ portfolio: Portfolio | null; isLoading: boolean }`
  - [x] Actions: `setPortfolio(portfolio: Portfolio)`, `setLoading(loading: boolean)`
  - [x] Export as `usePortfolioStore`
  - [x] Write tests: `frontend/src/stores/portfolioStore.test.ts`
    - setPortfolio updates store
    - initial state is null/false

- [x] Task 5: Implement REST API client stubs (AC: #3)
  - [x] Replace stub in `frontend/src/lib/api.ts`
  - [x] Implement: `fetchWatchlist(): Promise<WatchlistItem[]>` — `GET /api/watchlist`
  - [x] Implement: `fetchPortfolio(): Promise<Portfolio>` — `GET /api/portfolio`
  - [x] All fetch calls use relative URLs (`/api/...`) — same-origin, no CORS needed
  - [x] On non-ok response, parse JSON error body and throw `ApiError` with `message` and `code` fields
  - [x] Define and export `ApiError` class: `class ApiError extends Error { code: string }`
  - [x] No tests required for this task — API functions are thin wrappers; tested via integration in hook tests

- [x] Task 6: Implement `useSSE` hook (AC: #1, #4, #5, #6)
  - [x] Replace stub in `frontend/src/hooks/useSSE.ts`
  - [x] Creates a single `EventSource('/api/stream/prices')` on mount; closes on unmount
  - [x] SSE event payload format (from backend): `{"AAPL": {ticker, price, previous_price, timestamp, direction, change, change_percent}, "GOOGL": {...}, ...}` — a dict of ALL tracked tickers in one event
  - [x] On `EventSource.onmessage`: parse JSON, iterate all ticker keys, call `usePriceStore.getState().updatePrice(update)` for each
  - [x] On `EventSource.onopen`: call `usePriceStore.getState().setConnectionStatus('connected')`
  - [x] On `EventSource.onerror`: call `usePriceStore.getState().setConnectionStatus('reconnecting')`; schedule status→'disconnected' after 10 seconds of no reconnect using `setTimeout`
  - [x] On successful reconnect (onopen fires again): clear the disconnect timer; set status back to 'connected'
  - [x] Use `usePriceStore.getState()` (not reactive subscription) to avoid re-render on every price update
  - [x] This hook has **no return value** — it only drives store side effects
  - [x] Write tests: `frontend/src/hooks/useSSE.test.ts` (use `vi.fn()` + mock EventSource)
    - onopen sets connectionStatus to 'connected'
    - onmessage parses batch payload and calls updatePrice for each ticker
    - onerror sets connectionStatus to 'reconnecting'
    - cleanup: EventSource.close() called on unmount

- [x] Task 7: Initialize stores at app root (AC: #1, #3)
  - [x] Update `frontend/src/app/layout.tsx`: wrap children in a `Providers` client component
  - [x] Create `frontend/src/components/Providers.tsx` (`'use client'` directive):
    - Calls `useSSE()` to start the SSE connection
    - On mount: calls `fetchWatchlist()` and dispatches `useWatchlistStore.getState().setTickers(tickers.map(t => t.ticker))`
    - On mount: calls `fetchPortfolio()` and dispatches `usePortfolioStore.getState().setPortfolio(portfolio)` (catches errors silently — portfolio will be null on first load with no positions)
  - [x] `Providers` renders `{children}` after setup (no loading gate — prices stream immediately; empty states handled in child components)

- [x] Task 8: Implement `StatusDot` component (AC: #1, #4, #5, #6)
  - [x] Create `frontend/src/components/layout/StatusDot.tsx`
  - [x] Reads `connectionStatus` from `usePriceStore(s => s.connectionStatus)`
  - [x] Three visual states:
    - `connected`: 8px green circle (`bg-green-up`) with CSS box-shadow glow (`0 0 6px #3fb950`)
    - `reconnecting`: 8px yellow circle (`bg-accent-yellow`) with CSS `animate-pulse` Tailwind class
    - `disconnected`: 8px red circle (`bg-red-down`), no animation
  - [x] Renders label text beside the dot: `LIVE` / `RECONNECTING` / `DISCONNECTED` in matching color, `text-xs font-mono`
  - [x] Write tests: `frontend/src/components/layout/StatusDot.test.tsx`
    - renders green dot with LIVE when connected
    - renders yellow dot with RECONNECTING + pulse class when reconnecting
    - renders red dot with DISCONNECTED when disconnected

- [x] Task 9: Wire `StatusDot` into `Header` (AC: #1)
  - [x] Update `frontend/src/components/layout/Header.tsx`
  - [x] Import and render `<StatusDot />` in the header bar (right side)
  - [x] Initial state of `priceStore.connectionStatus` is `'disconnected'` — StatusDot starts red, turns green when SSE connects
  - [x] No tests required for this task — StatusDot unit tested separately; Header layout verified via build

- [x] Task 10: Build verification (all ACs)
  - [x] Run `cd frontend && npm run build` — zero TypeScript errors, zero lint errors
  - [x] Run `cd frontend && npm test -- --run` — all tests pass (16/16)
  - [x] Confirm: no hardcoded hex colors in any new file — use Tailwind design token classes only

## Dev Notes

### Critical: SSE Payload Format

The backend stream sends **all prices in a single batch event**, not individual ticker events:

```
data: {"AAPL": {"ticker":"AAPL","price":191.23,"previous_price":190.87,"timestamp":"...","direction":"up","change":0.36,"change_percent":0.19}, "GOOGL": {...}, ...}
```

The `useSSE.ts` `onmessage` handler **must iterate over all keys** in the parsed object and call `updatePrice` for each. Do not assume events are per-ticker.

Source: `backend/app/market/stream.py` — `_generate_events()` calls `{ticker: update.to_dict() for ticker, update in prices.items()}`.

### Tailwind v4 — No `tailwind.config.ts`

This project uses **Tailwind v4**. All design tokens are defined in `frontend/src/app/globals.css` via `@theme inline` block. There is no `tailwind.config.ts`.

- Use `bg-green-up`, `bg-red-down`, `bg-accent-yellow` for the StatusDot colors (from existing design tokens)
- Use `text-text-primary`, `text-text-muted` for text (token `text-primary` → class `text-text-primary`)
- `animate-pulse` is a built-in Tailwind utility class — no config needed

### Zustand Store Access Pattern

- **In components** (reactive): `const price = usePriceStore(s => s.prices['AAPL'])` — fine-grained selector
- **In the SSE hook** (non-reactive side effects): `usePriceStore.getState().updatePrice(update)` — avoid subscribing the hook itself
- **Never**: `const { prices } = usePriceStore()` — subscribes to the entire store, causes re-renders on every 500ms tick

### `'use client'` Requirement

All Zustand store hooks and browser APIs (`EventSource`, `useEffect`) require `'use client'` directive. The `Providers` component must be a client component. `layout.tsx` (Server Component) wraps it, but `Providers.tsx` handles all client-side initialization.

### SSE Reconnect: EventSource Built-In Behavior

The backend sends `retry: 1000\n\n` as the first SSE event, telling the browser to retry after 1 second on disconnect. `EventSource` handles reconnection **automatically** — do not implement manual retry logic. The hook only needs to:
1. Set status to `'reconnecting'` when `onerror` fires
2. Set status back to `'connected'` when `onopen` fires again
3. Set status to `'disconnected'` after a timeout (e.g., 10s) if reconnect hasn't succeeded

### Testing Setup

Frontend tests use **Vitest** (bundled with Next.js test setup). Run with `npm test`. Test files co-located with the source they test.

Check the existing test setup by looking at `frontend/package.json` for the test script and any existing test config. Do NOT assume Jest — Next.js 15 projects scaffold with Vitest by default.

If no test setup exists yet, add to `package.json`:
```json
"scripts": {
  "test": "vitest"
}
```
And install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react`

For the Vitest config, check if `vitest.config.ts` or `vite.config.ts` already exists. If not, create minimal `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
```
With `frontend/src/test/setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

### Sparkline Buffer Design

```typescript
// In priceStore.ts updatePrice action:
const SPARKLINE_CAP = 200

updatePrice: (update: PriceUpdate) =>
  set((state) => {
    const existing = state.sparklines[update.ticker] ?? []
    const appended = [...existing, update.price]
    return {
      prices: { ...state.prices, [update.ticker]: update },
      sparklines: {
        ...state.sparklines,
        [update.ticker]: appended.length > SPARKLINE_CAP
          ? appended.slice(-SPARKLINE_CAP)
          : appended,
      },
    }
  }),
```

### File Structure Additions

Files to create (new) or modify (existing stub):
- `frontend/src/types/index.ts` — replace stub (existing)
- `frontend/src/stores/priceStore.ts` — replace stub (existing)
- `frontend/src/stores/watchlistStore.ts` — **new file** (does not exist)
- `frontend/src/stores/portfolioStore.ts` — replace stub (existing)
- `frontend/src/lib/api.ts` — replace stub (existing)
- `frontend/src/hooks/useSSE.ts` — replace stub (existing)
- `frontend/src/components/Providers.tsx` — new file
- `frontend/src/components/layout/StatusDot.tsx` — new file
- `frontend/src/app/layout.tsx` — modify (add Providers wrapper)
- Test files (new): `priceStore.test.ts`, `watchlistStore.test.ts`, `portfolioStore.test.ts`, `useSSE.test.ts`, `StatusDot.test.tsx`

### Architecture Compliance

- Stores named `usePriceStore`, `usePortfolioStore`, `useWatchlistStore` — exactly matching architecture naming pattern [Source: architecture.md#Naming Patterns]
- Hook named `useSSE` — matches architecture [Source: architecture.md#Naming Patterns]
- All API calls go through `src/lib/api.ts` — no inline `fetch()` in components [Source: architecture.md#Communication Patterns]
- Frontend file structure matches architecture spec [Source: architecture.md#Structure Patterns]
- No hardcoded hex colors — Tailwind design tokens only [Source: 1-2-frontend-shell-design-system.md#Architecture Constraints]

### Tailwind v4 CSS Variable Mapping

Generated from `@theme inline` in `globals.css`:
- `bg-background` → `#0d1117`
- `bg-surface` → `#161b22`
- `bg-green-up` → `#3fb950`
- `bg-red-down` → `#f85149`
- `bg-accent-yellow` → `#ecad0a`
- `text-text-primary` → `#e6edf3`
- `text-text-muted` → `#8b949e`
- `font-mono` → JetBrains Mono

### References

- SSE event format: [Source: backend/app/market/stream.py#_generate_events]
- PriceUpdate fields: [Source: backend/CLAUDE.md#Core Types]
- Zustand store naming: [Source: architecture.md#Naming Patterns — `use{Domain}Store`]
- Store update rules: [Source: architecture.md#Communication Patterns — Zustand store update rules]
- API naming pattern: [Source: architecture.md#Naming Patterns — `{verb}{Resource}`]
- SSE architecture: [Source: architecture.md#Frontend Architecture — SSE connection management]
- Tailwind v4 token definition: [Source: 1-2-frontend-shell-design-system.md#Tailwind v4 Adaptation Note]
- StatusDot spec: [Source: ux-design-specification.md#Component Strategy — StatusDot]
- Connection states: [Source: epics.md#Story 1.3 AC #4, #5, #6]

### Review Findings

- [x] [Review][Patch] Unhandled JSON.parse exception in useSSE onmessage [`frontend/src/hooks/useSSE.ts:23`] — fixed: wrapped in try/catch with console.error logging; malformed frames are skipped, stream stays alive
- [x] [Review][Defer] React Strict Mode double-mount creates duplicate EventSource in development [`frontend/src/hooks/useSSE.ts:10`] — deferred, dev-only concern; static export means Strict Mode double-invoke only affects local dev, not production
- [x] [Review][Defer] No validation that batch values have non-null price before appending to sparkline [`frontend/src/hooks/useSSE.ts:25`] — deferred, simulated backend has a known-good schema; revisit if live API is added
- [x] [Review][Defer] No logging/instrumentation for connection state transitions — deferred, observability enhancement, not a correctness issue

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- Installed Vitest test framework (no test setup existed prior): `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@vitejs/plugin-react`
- Created `vitest.config.ts` with jsdom environment and `@` alias (mirrors Next.js tsconfig paths)
- Created `src/test/setup.ts` with `@testing-library/jest-dom` import
- Added `"test": "vitest"` script to `package.json`
- `StatusDot` uses inline `style` for glow (box-shadow) since Tailwind v4 doesn't have a shadow token matching `0 0 6px #3fb950`; all color classes use design tokens only
- `useSSE` guards against double-scheduling the disconnect timer with `disconnectTimer === null` check
- Build produces clean static export — 0 TypeScript errors, 0 lint errors
- All 16 tests pass across 5 test files

### File List

- `frontend/src/types/index.ts` — replaced stub
- `frontend/src/stores/priceStore.ts` — replaced stub
- `frontend/src/stores/priceStore.test.ts` — new
- `frontend/src/stores/watchlistStore.ts` — new
- `frontend/src/stores/watchlistStore.test.ts` — new
- `frontend/src/stores/portfolioStore.ts` — replaced stub
- `frontend/src/stores/portfolioStore.test.ts` — new
- `frontend/src/lib/api.ts` — replaced stub
- `frontend/src/hooks/useSSE.ts` — replaced stub
- `frontend/src/hooks/useSSE.test.ts` — new
- `frontend/src/components/Providers.tsx` — new
- `frontend/src/components/layout/StatusDot.tsx` — new
- `frontend/src/components/layout/StatusDot.test.tsx` — new
- `frontend/src/components/layout/Header.tsx` — modified (added StatusDot)
- `frontend/src/app/layout.tsx` — modified (added Providers wrapper)
- `frontend/vitest.config.ts` — new
- `frontend/src/test/setup.ts` — new
- `frontend/package.json` — modified (added test script + dev dependencies)
