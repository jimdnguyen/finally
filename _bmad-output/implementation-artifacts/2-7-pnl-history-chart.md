# Story 2.7: P&L History Chart

Status: done

## Story

As a **user tracking my performance over time**,
I want **a line chart showing my total portfolio value history**,
so that **I can see whether my trading is profitable**.

## Acceptance Criteria

1. **Given** the P&L History tab is active, **when** the chart renders, **then** it uses Lightweight Charts with a line series plotting `{time: recorded_at, value: total_value}` from `GET /api/portfolio/history`.
2. **Given** no snapshots exist yet, **when** the chart renders, **then** it shows muted text: "No history yet — portfolio snapshots appear after your first trade" (no chart, no skeleton).
3. **Given** a trade executes, **when** the trade response returns, **then** `portfolioStore` is refetched which also triggers a history refetch, and the new snapshot point appears on the chart.
4. **Given** the `TabStrip` renders below the main chart, **when** inspecting it, **then** it shows tabs: Heatmap · Positions · P&L History; active tab has blue bottom border; 30px fixed height; tab switching is instant (no transition animation).
5. **Given** the P&L History chart renders, **when** the portfolio history has data, **then** the chart uses the same dark theme as the main chart (background `#0d1117`, grid `#30363d`).

## Tasks / Subtasks

- [x] Task 1: Add `fetchPortfolioHistory()` to api.ts and extend portfolioStore (AC: 1, 3)
  - [x] 1.1 Add `fetchPortfolioHistory()` to `frontend/src/lib/api.ts` — calls `GET /api/portfolio/history`, returns `PortfolioSnapshot[]`. Use existing `apiFetch<T>` pattern. Type `PortfolioSnapshot` already exists in `types/index.ts`.
  - [x] 1.2 Extend `portfolioStore.ts` — add `history: PortfolioSnapshot[] | null`, `setHistory: (history: PortfolioSnapshot[]) => void`. Keep `null` as the initial value to distinguish "not yet loaded" from "loaded but empty array".
  - [x] 1.3 Update `Providers.tsx` — add `fetchPortfolioHistory()` call **in parallel** alongside the existing `fetchPortfolio()` call (they are independent API calls, not sequential). Use `getState().setHistory()` pattern consistent with existing calls.
  - [x] 1.4 Write tests for api.ts changes: mock fetch, verify `fetchPortfolioHistory()` calls correct endpoint, returns typed result.
  - [x] 1.5 Write tests for portfolioStore changes: verify `setHistory()` updates state, initial `history` is `null`.
  - [x] 1.6 Run frontend tests — all must pass before proceeding.

- [x] Task 2: Create `TabStrip` component (AC: 4)
  - [x] 2.1 Create `frontend/src/components/layout/TabStrip.tsx` — a `'use client'` component that renders tab buttons. Props: `tabs: string[]`, `activeTab: string`, `onTabChange: (tab: string) => void`. Tabs are: `['Heatmap', 'Positions', 'P&L History']`.
  - [x] 2.2 Styling: 30px fixed height (`h-[30px]`), `flex items-center`, `border-b border-border` at bottom. Each tab: `px-4 text-xs font-semibold cursor-pointer`. Active tab: blue bottom border (`border-b-2 border-blue-primary` using `#209dd7`), `text-text-primary`. Inactive tab: `text-text-muted`, no bottom border. No transition animation on switch.
  - [x] 2.3 Create `frontend/src/components/layout/TabStrip.test.tsx` — test: renders 3 tab labels, active tab has blue border class, clicking inactive tab calls `onTabChange`, inactive tabs have muted text class.
  - [x] 2.4 Run frontend tests — all must pass before proceeding.

- [x] Task 3: Create `PnLHistoryChart` component (AC: 1, 2, 5)
  - [x] 3.1 Create `frontend/src/components/layout/PnLHistoryChart.tsx` — a `'use client'` component. Subscribe to `usePortfolioStore((s) => s.history)` for snapshot data.
  - [x] 3.2 Empty state: when `history` is `null` or `history.length === 0`, render centered muted text: `"No history yet — portfolio snapshots appear after your first trade"` (UX-DR17). Do NOT create the chart when there's no data.
  - [x] 3.3 Chart creation: follow `MainChart.tsx` pattern exactly — `createChart()` in a `useEffect`, store refs for `chartRef` and `seriesRef`, attach `ResizeObserver` for responsive sizing, cleanup on unmount.
  - [x] 3.4 Dark theme (AC-5): `layout.background: { type: ColorType.Solid, color: '#0d1117' }`, `layout.textColor: '#8b949e'`, `grid vertLines/horzLines: '#30363d'`, `crosshair: '#30363d'` with `labelBackgroundColor: '#753991'`, `rightPriceScale/timeScale borderColor: '#30363d'` — identical to MainChart.
  - [x] 3.5 Line series: `chart.addSeries(LineSeries, { color: '#209dd7', lineWidth: 2, priceLineVisible: true, lastValueVisible: true })` — same style as MainChart.
  - [x] 3.6 Data mapping: convert `PortfolioSnapshot[]` to Lightweight Charts data format. The `recorded_at` is an ISO string — check `node_modules/lightweight-charts/dist/typings.d.ts` (or LWC v5 docs via context7) to confirm the expected time type (`UTCTimestamp` as seconds-since-epoch, `BusinessDay`, or string). Convert `recorded_at` accordingly. Data is already sorted ascending from the backend.
  - [x] 3.7 Data update effect: second `useEffect` watching `history` — call `seriesRef.current.setData(mapped)` then `chartRef.current.timeScale().fitContent()`. On subsequent updates (new snapshots), full `setData` is fine since history is small.
  - [x] 3.8 Create `frontend/src/components/layout/PnLHistoryChart.test.tsx` — mock `lightweight-charts` (same approach as MainChart tests if they exist, or mock `createChart` returning `{ addSeries, resize, remove, timeScale }` stubs). Test: empty state text when history is null, empty state text when history is `[]`, chart container renders when history has data, verify `createChart` called with dark theme config.
  - [x] 3.9 Run frontend tests — all must pass before proceeding.

- [x] Task 4: Refactor CenterPanel with TabStrip (AC: 4)
  - [x] 4.1 Modify `frontend/src/components/layout/CenterPanel.tsx` — replace the current 40/60 heatmap/positions split with: TabStrip + conditional panel rendering. Use `useState` for `activeTab`, default to `'Positions'`.
  - [x] 4.2 Layout: `MainChart` (flex-1) → `TradeBar` → `TabStrip` (30px) → bottom panel (`h-64 min-h-[10rem]`). The bottom panel renders ONE of: `PortfolioHeatmap` (when tab = 'Heatmap'), `PositionsTable` (when tab = 'Positions'), `PnLHistoryChart` (when tab = 'P&L History').
  - [x] 4.3 Remove the `border-b` between heatmap and positions table — TabStrip replaces that split. Keep `border-t border-border` above TabStrip area.
  - [x] 4.4 Update `frontend/src/components/layout/CenterPanel.test.tsx` — add TabStrip mock, test: default tab is Positions (PositionsTable visible), switching to Heatmap shows PortfolioHeatmap, switching to P&L History shows PnLHistoryChart. Update existing tests that relied on both heatmap and positions being visible simultaneously.
  - [x] 4.5 Run frontend tests — all must pass before proceeding.

- [x] Task 5: History refetch on trade (AC: 3)
  - [x] 5.1 Update trade flow: after `executeTrade()` succeeds and updates portfolioStore in `TradeBar.tsx`, also call `fetchPortfolioHistory()` and update `portfolioStore.getState().setHistory()`. This ensures the new post-trade snapshot appears on the chart.
  - [x] 5.2 Test: verify that after a successful trade execution in TradeBar, `fetchPortfolioHistory` is called. (Mock the API call and verify invocation.)
  - [x] 5.3 Run frontend tests — all must pass before proceeding.

- [x] Task 6: Full regression test run (all ACs)
  - [x] 6.1 Run ALL frontend tests — existing + new must pass (117/117)
  - [x] 6.2 Run ALL backend tests (`uv run --extra dev pytest -v`) — ensure no regressions (130/130)

## Review Findings

### Dismissed (7 false positives)
- LWC time format, empty state clearing, chart lifecycle on tab switch, tab state reset, stale state after unmount, useEffect infinite update, empty state CSS quirk — all confirmed false positives.

### Deferred
- [x] [Review][Defer] Race condition: rapid trades may receive out-of-order history responses [TradeBar.tsx:29] — deferred, pre-existing fire-and-forget pattern; single-user simulator
- [x] [Review][Defer] Silent error swallowing in fetchPortfolioHistory `.catch(() => {})` [Providers.tsx, TradeBar.tsx] — deferred, intentional per Dev Notes; consistent with all fetches
- [x] [Review][Defer] ResizeObserver null-ref on rapid unmount [PnLHistoryChart.tsx:45] — deferred, same pattern as MainChart.tsx reference impl; cleanup ordering prevents in practice
- [x] [Review][Defer] Client-side data ordering not validated before setData [PnLHistoryChart.tsx:61] — deferred, spec guarantees backend provides sorted data
- [x] [Review][Defer] TabStrip keyboard accessibility (aria-selected, role="tab") [TabStrip.tsx] — deferred, legitimate enhancement; not required by spec

## Dev Notes

### Architecture Compliance

**Lightweight Charts v5.1.0** — already installed (`frontend/package.json`). Use `createChart`, `LineSeries`, `ColorType` imports from `lightweight-charts`. Do NOT install Recharts or any other charting library. [Source: package.json, MainChart.tsx pattern]

**TabStrip (UX-DR11)** — tabs: Heatmap, Positions, P&L History. 30px fixed height. Blue bottom border on active tab. Instant panel swap — no CSS transitions. [Source: _bmad-output/planning-artifacts/epics.md, UX-DR11]

**Post-trade refetch (ARCH-11)** — after `executeTrade()` succeeds, refetch both portfolio AND portfolio history. Current TradeBar already refetches portfolio; add history refetch alongside it. [Source: epics.md ARCH-11]

### Existing Code to Reuse (DO NOT reinvent)

- **`MainChart.tsx`** (lines 21-62) — Chart creation pattern: `createChart()` with dark theme config, `addSeries(LineSeries)`, `ResizeObserver`, refs for chart/series, cleanup on unmount. Copy this pattern exactly for PnLHistoryChart.
- **`api.ts:apiFetch<T>`** — Generic fetch wrapper. `fetchPortfolioHistory()` is one line: `return apiFetch<PortfolioSnapshot[]>('/api/portfolio/history')`
- **`portfolioStore.ts`** — Extend with `history` state. Pattern: `history: PortfolioSnapshot[] | null`, same as `portfolio: Portfolio | null`.
- **`Providers.tsx`** — Initial data fetch pattern. Add `fetchPortfolioHistory()` call alongside existing `fetchPortfolio()`.
- **`types/index.ts:PortfolioSnapshot`** — Already defined: `{ recorded_at: string, total_value: number }`. No type creation needed.
- **`TradeBar.tsx`** — Post-trade refetch location. Find where `fetchPortfolio().then(setPortfolio)` is called after trade success; add history refetch there.

### Backend Endpoint (Already Exists)

`GET /api/portfolio/history` returns `PortfolioHistoryPoint[]` (`{recorded_at, total_value}`) sorted ascending by `recorded_at`. No backend changes needed. [Source: backend/app/portfolio/router.py]

### P&L Sign Formatting (UX-DR20)

Not directly needed for this story (chart is a line, not tabular data), but if any value labels are shown, use `+` for positive, `\u2212` (U+2212) for negative.

### Empty State (UX-DR17)

Exact text: `"No history yet — portfolio snapshots appear after your first trade"` — muted text, centered, no illustrations, no icons. Use `text-text-muted text-sm` classes, centered with flexbox. [Source: _bmad-output/planning-artifacts/ux-design-specification.md, UX-DR17]

### Color/Design Tokens

- Blue primary: `#209dd7` — used for line series color AND active tab bottom border
- Purple secondary: `#753991` — crosshair label background
- Background: `#0d1117` — chart background
- Grid/border: `#30363d` — chart grid lines, scale borders
- Text: `#8b949e` — chart axis labels
- `text-text-primary`, `text-text-muted`, `border-border` — Tailwind tokens for TabStrip

### Testing Pattern

- Co-located test files in `components/layout/`
- Mock `lightweight-charts` module — `vi.mock('lightweight-charts', ...)` returning stubs for `createChart`, `LineSeries`, `ColorType`
- Mock sibling components in CenterPanel test: `vi.mock('./PnLHistoryChart', ...)`, `vi.mock('./TabStrip', ...)`
- Store testing: `usePortfolioStore.setState({ history: [...] })` for direct state manipulation
- API testing: mock global `fetch` with `vi.fn()`

### CRITICAL: Read Next.js Docs First

The `frontend/AGENTS.md` warns: *"This is NOT the Next.js you know."* Check `node_modules/next/dist/docs/` for breaking changes before modifying client components.

### Previous Story Intelligence (2.5, 2.6)

- **Stable fallback constants** (Learning #25): Use `const EMPTY_HISTORY: PortfolioSnapshot[] = []` at module level if needed — never inline `?? []` in selectors. However, for history use `null` to distinguish "not loaded" from "empty" — only use the constant as a render-time fallback.
- **getState() in async callbacks** (Learning #27): Use `getState()` for setting store state after async API calls (in Providers, TradeBar). Use hooks for reactive data in render functions.
- **Fallback values that destroy state** (Learning #32): Use `null` as initial history state, not `[]`. An empty array means "loaded, no data"; null means "not yet loaded". `.catch(() => null)` or `.catch(() => {})` — don't `.catch(() => [])` which would hide errors as empty state.
- **getState() snapshot vs hook subscription** (Learning #36): PnLHistoryChart must use `usePortfolioStore((s) => s.history)` hook, NOT `getState()`, so it re-renders when history updates.

### CenterPanel Refactor Notes

Current layout (Story 2.6):
```
MainChart (flex-1) → TradeBar → [40% Heatmap | 60% PositionsTable]
```

New layout (Story 2.7):
```
MainChart (flex-1) → TradeBar → TabStrip (30px) → ActivePanel (h-64)
```

The bottom panel switches between Heatmap, PositionsTable, and PnLHistoryChart based on active tab. Default tab: `'Positions'` (most commonly needed view). CenterPanel test needs updating — tests that expect both heatmap and positions visible simultaneously must change to reflect tab-switched behavior.

### Project Structure Notes

- `frontend/src/components/layout/TabStrip.tsx` — NEW: Tab navigation component
- `frontend/src/components/layout/TabStrip.test.tsx` — NEW: TabStrip tests
- `frontend/src/components/layout/PnLHistoryChart.tsx` — NEW: P&L line chart component
- `frontend/src/components/layout/PnLHistoryChart.test.tsx` — NEW: PnLHistoryChart tests
- `frontend/src/components/layout/CenterPanel.tsx` — MODIFY: Replace heatmap/positions split with TabStrip + conditional rendering
- `frontend/src/components/layout/CenterPanel.test.tsx` — MODIFY: Update for tab-based layout
- `frontend/src/lib/api.ts` — MODIFY: Add `fetchPortfolioHistory()`
- `frontend/src/lib/api.test.ts` — MODIFY: Add test for `fetchPortfolioHistory()`
- `frontend/src/stores/portfolioStore.ts` — MODIFY: Add `history` state + `setHistory` action
- `frontend/src/components/Providers.tsx` — MODIFY: Add initial history fetch
- `frontend/src/components/layout/TradeBar.tsx` — MODIFY: Add history refetch after trade

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 2.7 ACs, FR18, FR31]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — UX-DR11 TabStrip, UX-DR17 empty states, UX-DR20 P&L sign, UX-DR21 color usage]
- [Source: frontend/src/components/layout/MainChart.tsx — chart creation pattern, dark theme config, ResizeObserver]
- [Source: frontend/src/stores/portfolioStore.ts — current store shape to extend]
- [Source: frontend/src/lib/api.ts — apiFetch pattern, existing API functions]
- [Source: frontend/src/types/index.ts — PortfolioSnapshot type already defined]
- [Source: frontend/src/components/layout/CenterPanel.tsx — current layout to refactor]
- [Source: frontend/src/components/Providers.tsx — initial fetch pattern]
- [Source: backend/app/portfolio/router.py — /api/portfolio/history endpoint]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed conditional rendering bug in PnLHistoryChart: chart container must always be in DOM for useEffect `[]` to find the ref. Used `invisible` class + absolute overlay for empty state instead of early return.

### Completion Notes List

- Task 1: Added `fetchPortfolioHistory()` to api.ts, extended portfolioStore with `history`/`setHistory`, added parallel fetch in Providers.tsx. Tests: 108/108.
- Task 2: Created TabStrip component with 30px height, blue border active tab, instant swap. Tests: 113/113.
- Task 3: Created PnLHistoryChart with LWC dark theme, LineSeries, ResizeObserver. Fixed conditional rendering bug (container always in DOM). Tests: 115/115.
- Task 4: Refactored CenterPanel — replaced 40/60 heatmap/positions split with TabStrip + conditional panel rendering. Default tab: Positions. Tests: 116/116.
- Task 5: Added `fetchPortfolioHistory()` call in TradeBar after successful trade. Tests: 117/117.
- Task 6: Full regression — frontend 117/117, backend 130/130.

### Change Log

- `frontend/src/lib/api.ts` — Added `fetchPortfolioHistory()`
- `frontend/src/lib/api.test.ts` — Added tests for `fetchPortfolioHistory()`
- `frontend/src/stores/portfolioStore.ts` — Added `history: PortfolioSnapshot[] | null`, `setHistory()`
- `frontend/src/stores/portfolioStore.test.ts` — Added tests for history state
- `frontend/src/components/Providers.tsx` — Added parallel `fetchPortfolioHistory()` call
- `frontend/src/components/layout/TabStrip.tsx` — NEW: Tab navigation component
- `frontend/src/components/layout/TabStrip.test.tsx` — NEW: 5 tests
- `frontend/src/components/layout/PnLHistoryChart.tsx` — NEW: P&L line chart with LWC
- `frontend/src/components/layout/PnLHistoryChart.test.tsx` — NEW: 7 tests
- `frontend/src/components/layout/CenterPanel.tsx` — Refactored to use TabStrip + conditional panels
- `frontend/src/components/layout/CenterPanel.test.tsx` — Updated for tab-based layout, 8 tests
- `frontend/src/components/layout/TradeBar.tsx` — Added history refetch after trade
- `frontend/src/components/layout/TradeBar.test.tsx` — Added history refetch test

### File List

- `frontend/src/lib/api.ts` — MODIFIED
- `frontend/src/lib/api.test.ts` — MODIFIED
- `frontend/src/stores/portfolioStore.ts` — MODIFIED
- `frontend/src/stores/portfolioStore.test.ts` — MODIFIED
- `frontend/src/components/Providers.tsx` — MODIFIED
- `frontend/src/components/layout/TabStrip.tsx` — NEW
- `frontend/src/components/layout/TabStrip.test.tsx` — NEW
- `frontend/src/components/layout/PnLHistoryChart.tsx` — NEW
- `frontend/src/components/layout/PnLHistoryChart.test.tsx` — NEW
- `frontend/src/components/layout/CenterPanel.tsx` — MODIFIED
- `frontend/src/components/layout/CenterPanel.test.tsx` — MODIFIED
- `frontend/src/components/layout/TradeBar.tsx` — MODIFIED
- `frontend/src/components/layout/TradeBar.test.tsx` — MODIFIED
