# Story 2.3: Positions Table & Portfolio Header

Status: done

## Story

As a **user monitoring my portfolio**,
I want **a positions table showing my holdings with live-updating prices and P&L, and a header displaying my total portfolio value and cash balance**,
so that **I can track my investments at a glance without manually refreshing**.

## Acceptance Criteria

1. **Given** the user has positions, **when** the `PositionsTable` renders, **then** it shows columns: Ticker · Qty · Avg Cost · Price · Unrealized P&L · %; all numeric cells use JetBrains Mono font.
2. **Given** a price update arrives, **when** the positions table re-renders, **then** `current_price`, `unrealized_pnl`, and `pnl_pct` update live from `priceStore` (no refetch needed for price updates — only on trade execution).
3. **Given** P&L is positive, **when** rendered, **then** it shows explicit `+` prefix in `green-up` color; negative shows `−` (U+2212) in `red-down` color (UX-DR20 — sign and color always agree).
4. **Given** the user has no positions, **when** the table renders, **then** it shows muted text: "No positions — buy something to get started" (no illustrations, no icons).
5. **Given** the `Header` renders, **when** portfolio value updates, **then** it displays: live total portfolio value (from `portfolioStore`), cash balance, and `StatusDot`; brand logo in `accent-yellow`; all within 48px fixed height.

## Tasks / Subtasks

- [x] Task 1: Create `PositionsTable` component (AC: 1, 2, 3, 4)
  - [x] 1.1 Create `frontend/src/components/layout/PositionsTable.tsx` — client component subscribing to `usePortfolioStore` for positions and `usePriceStore` for live price overlays
  - [x] 1.2 Render table with columns: Ticker · Qty · Avg Cost · Price · Unrealized P&L · %. All numeric cells use `font-mono` class (maps to JetBrains Mono). Column headers use `font-sans text-text-muted` for labels.
  - [x] 1.3 Implement live price overlay: for each position, read `priceStore.prices[ticker]?.price`; if available, use it instead of `position.current_price` to compute displayed `current_price`, `unrealized_pnl`, and `pnl_pct` in real-time
  - [x] 1.4 Implement P&L formatting per UX-DR20: positive values show `+` prefix in `text-green-up`; negative values show `\u2212` (Unicode minus) prefix in `text-red-down`; zero shows `$0.00` / `0.00%` in `text-text-muted`
  - [x] 1.5 Implement empty state: when `positions.length === 0`, render centered muted text: "No positions — buy something to get started"
  - [x] 1.6 Write tests in `frontend/src/components/layout/PositionsTable.test.tsx`:
    - Renders all columns with correct data
    - Positive P&L shows `+` prefix and green color
    - Negative P&L shows `−` (U+2212) prefix and red color
    - Empty state renders correct message when no positions

- [x] Task 2: Wire `PositionsTable` into `CenterPanel` (AC: 1)
  - [x] 2.1 Modify `frontend/src/components/layout/CenterPanel.tsx` — add `PositionsTable` below the `MainChart` area (replace the `{/* TODO: TabStrip + TradeBar (Story 2.x) */}` comment)
  - [x] 2.2 Give `PositionsTable` a scrollable container with a max height so it doesn't push the chart off-screen. Chart should take priority space (`flex-1 min-h-0`), table takes remaining space with overflow scroll.
  - [x] 2.3 Update `CenterPanel.test.tsx` if needed to account for new child component

- [x] Task 3: Enhance `Header` with portfolio value and cash balance (AC: 5)
  - [x] 3.1 Convert `Header.tsx` to a client component (`'use client'`) — it needs to subscribe to `usePortfolioStore`
  - [x] 3.2 Display total portfolio value: `font-mono text-lg font-semibold` (JetBrains Mono 18-20px). Format as `$XX,XXX.XX` with comma separators.
  - [x] 3.3 Display cash balance: `font-mono text-sm text-text-muted`. Format as `Cash: $X,XXX.XX`.
  - [x] 3.4 Layout: brand logo left, portfolio value + cash center or right-center, StatusDot right — all within existing `h-12` constraint
  - [x] 3.5 Handle loading state: show `—` placeholder when `portfolio` is null (before initial fetch completes)
  - [x] 3.6 Write tests in `frontend/src/components/layout/Header.test.tsx`:
    - Renders brand logo
    - Shows portfolio value and cash balance from store
    - Shows placeholder when portfolio is null
    - StatusDot still renders

- [x] Task 4: Full regression test run
  - [x] 4.1 Run ALL frontend tests — existing + new must pass (66 passed, 0 failed)
  - [x] 4.2 Run ALL backend tests (`uv run --extra dev pytest -v`) — ensure no regressions (130 passed, 0 failed)

## Dev Notes

### Architecture Compliance

**Component location**: All components go in `frontend/src/components/layout/` — this is the established pattern (WatchlistPanel, WatchlistRow, CenterPanel, MainChart, Header, ChatPanel all live here).

**Client components**: PositionsTable and Header both need `'use client'` since they subscribe to Zustand stores. Header is currently a server component — it must be converted.

**ARCH-11 — Post-trade refetch**: Positions data comes from `portfolioStore.portfolio.positions` (fetched via `GET /api/portfolio`). After a trade, the portfolio MUST be refetched — never optimistically updated. However, between trades, live price updates from `priceStore` overlay the stale `current_price` from the last fetch. This is the key distinction:
- **Portfolio structure** (positions, quantities, avg_cost, cash): from `portfolioStore`, updated only on trade
- **Live prices**: from `priceStore`, updated every ~500ms via SSE

**ARCH-12 — snake_case**: The backend API returns `snake_case` fields (`avg_cost`, `unrealized_pnl`, `pnl_pct`). TypeScript types already match this convention (see `types/index.ts`).

### Live Price Overlay Pattern

This is the most important implementation detail. The `PositionsTable` must compute displayed values by merging two stores:

```typescript
// For each position from portfolioStore:
const livePrice = usePriceStore((s) => s.prices[position.ticker]?.price)
const displayPrice = livePrice ?? position.current_price
const unrealizedPnl = (displayPrice - position.avg_cost) * position.quantity
const pnlPct = ((displayPrice - position.avg_cost) / position.avg_cost) * 100
```

**Why not just use `position.current_price`?** That value is a snapshot from the last `GET /api/portfolio` call. Between trades, the SSE stream pushes live prices into `priceStore`. To show live-updating P&L without refetching the portfolio API on every tick, overlay the `priceStore` price.

**Why not refetch portfolio on every tick?** That would hammer the API with requests every 500ms. The overlay pattern is zero-cost — it reads from the in-memory Zustand store.

### P&L Formatting (UX-DR20)

Follow the exact same pattern established in `WatchlistRow.tsx:14-19`:

```typescript
const sign = value >= 0 ? '+' : '\u2212'  // U+2212 Unicode minus, NOT hyphen-minus
```

- Positive: `+$123.45` in `text-green-up`
- Negative: `−$123.45` in `text-red-down` (U+2212, not `-`)
- Zero: `$0.00` in `text-text-muted`

### Number Formatting

Use `Intl.NumberFormat` or `toLocaleString()` for comma-separated currency values in the Header:

```typescript
const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
fmt.format(10234.5) // "$10,234.50"
```

For table cells, simpler `.toFixed(2)` is fine (values are smaller, commas optional).

### Typography (from UX spec)

| Element | Font | Size | Weight | Tailwind |
|---------|------|------|--------|----------|
| Header portfolio value | JetBrains Mono | 18-20px | 600 | `font-mono text-lg font-semibold` |
| Header cash label | Inter/system-ui | 12px | 400 | `font-sans text-xs text-text-muted` |
| Header cash value | JetBrains Mono | 14px | 500 | `font-mono text-sm text-text-muted` |
| Table numeric cells | JetBrains Mono | 13-14px | 500 | `font-mono text-sm` |
| Table ticker column | JetBrains Mono | 13-14px | 600 | `font-mono text-sm font-semibold` |
| Table headers | Inter/system-ui | 11-12px | 400-600 | `font-sans text-xs text-text-muted` |

### Existing Code to Reuse (DO NOT reinvent)

- `usePortfolioStore` (`stores/portfolioStore.ts`) — `portfolio.positions`, `portfolio.cash_balance`, `portfolio.total_value`
- `usePriceStore` (`stores/priceStore.ts`) — `prices[ticker].price` for live overlay
- `fetchPortfolio()` (`lib/api.ts`) — already called in `Providers.tsx` on mount
- Design tokens already in `globals.css`: `text-green-up`, `text-red-down`, `text-text-muted`, `text-accent-yellow`, `bg-surface`, `border-border`
- Font variables already configured in `layout.tsx`: `--font-jetbrains-mono`, `--font-inter` → Tailwind `font-mono`, `font-sans`
- U+2212 pattern in `WatchlistRow.tsx:17` — reuse the sign formatting approach

### Testing Pattern (from previous stories)

Frontend tests use Vitest + React Testing Library. Existing test files follow the pattern:
- Co-located: `ComponentName.test.tsx` alongside `ComponentName.tsx`
- Mock Zustand stores by importing and calling `setState` directly
- Test rendering, user interaction, and conditional displays
- See `WatchlistRow.test.tsx`, `CenterPanel.test.tsx` for examples

### CenterPanel Layout

Current `CenterPanel.tsx` has a `flex-col` layout with `MainChart` taking `flex-1`. Add `PositionsTable` below with a fixed or constrained height. Suggested layout:

```tsx
<section className="flex-1 bg-background overflow-hidden flex flex-col">
  <div className="flex-1 min-h-0">
    <MainChart />
  </div>
  <div className="h-48 min-h-[8rem] border-t border-border overflow-auto">
    <PositionsTable />
  </div>
</section>
```

The exact height can be tuned — `h-48` (192px) is a starting point. The table scrolls internally if positions exceed the space.

### CRITICAL: Read Next.js Docs First

The `frontend/AGENTS.md` warns: *"This is NOT the Next.js you know... Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."* Check for any breaking changes in client components or font usage before implementation.

### Project Structure Notes

- `frontend/src/components/layout/PositionsTable.tsx` — NEW: positions table component
- `frontend/src/components/layout/PositionsTable.test.tsx` — NEW: tests
- `frontend/src/components/layout/Header.tsx` — MODIFY: add portfolio value + cash balance, convert to client component
- `frontend/src/components/layout/Header.test.tsx` — NEW or MODIFY: tests for enhanced header
- `frontend/src/components/layout/CenterPanel.tsx` — MODIFY: add PositionsTable below chart

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 2.3 acceptance criteria, lines 318-331]
- [Source: _bmad-output/planning-artifacts/architecture.md — ARCH-11 post-trade refetch, ARCH-12 snake_case, ARCH-21 domain structure]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — UX-DR13 positions table, UX-DR14 header, UX-DR20 P&L sign rules]
- [Source: _bmad-output/implementation-artifacts/2-2-portfolio-snapshot-background-task.md — previous story intelligence]
- [Source: frontend/src/components/layout/WatchlistRow.tsx — U+2212 formatting pattern, price store subscription]
- [Source: frontend/src/components/layout/CenterPanel.tsx — TODO comment for tab/trade area]
- [Source: frontend/src/stores/portfolioStore.ts — existing store shape]
- [Source: frontend/src/stores/priceStore.ts — live price subscription pattern]
- [Source: frontend/src/components/Providers.tsx — portfolio fetch on mount]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed Zustand selector stability issue: `?? []` causes infinite re-renders when `portfolio` is null; used module-level `EMPTY_POSITIONS` constant instead (same pattern as `WatchlistRow.tsx`)

### Completion Notes List

- Task 1: Created `PositionsTable` with live price overlay pattern, P&L formatting (UX-DR20), and empty state. 7 tests all passing.
- Task 2: Wired `PositionsTable` into `CenterPanel` below `MainChart` with scrollable `h-48` container. 4 CenterPanel tests passing.
- Task 3: Converted `Header` to client component with `Intl.NumberFormat` for portfolio value and cash balance, loading placeholder. 4 Header tests passing.
- Task 4: Full regression — 66 frontend tests + 130 backend tests = 196 total, 0 failures.

### Review Findings

- [x] [Review][Patch] Header cash value missing `font-medium` for 500 weight per UX spec [Header.tsx:21] — fixed

### File List

- `frontend/src/components/layout/PositionsTable.tsx` — NEW: Positions table with live price overlay
- `frontend/src/components/layout/PositionsTable.test.tsx` — NEW: 7 tests
- `frontend/src/components/layout/CenterPanel.tsx` — MODIFIED: Added PositionsTable below MainChart
- `frontend/src/components/layout/CenterPanel.test.tsx` — MODIFIED: Added 2 tests for PositionsTable integration
- `frontend/src/components/layout/Header.tsx` — MODIFIED: Converted to client component with portfolio value + cash
- `frontend/src/components/layout/Header.test.tsx` — NEW: 4 tests
- `_bmad-output/implementation-artifacts/2-3-positions-table-portfolio-header.md` — MODIFIED: Story status tracking
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED: Story status updated
