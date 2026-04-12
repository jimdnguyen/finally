# Story 1.5 — Main Chart & Ticker Selection

## Status: done

## Story

**As a** user who wants to analyze a specific ticker,
**I want** to click a ticker in the watchlist and see a detailed price chart,
**so that** I can track price action for my chosen stock.

---

## Acceptance Criteria

- **AC1** — On initial load, AAPL is selected by default and its chart displays. The AAPL watchlist row shows a blue (`#209dd7`) left border indicating active selection.
- **AC2** — Clicking a different ticker in the watchlist instantly switches the main chart to that ticker's price history (from `priceStore` sparkline data). The blue left border moves to the new row. No loading state, no transition delay.
- **AC3** — While a ticker is selected, new price events arriving for that ticker update the chart in real time (via `series.update()`).
- **AC4** — `ResizeObserver` on the chart container triggers `chart.resize(width, height)` when the browser window or layout changes. The chart fills its container without overflow or clipping.
- **AC5** — Full dark theme applied to the chart: background `#0d1117`, grid lines `#30363d`, axis text `#8b949e`, price line `#209dd7`. Uses LightweightCharts `createChart()` with explicit theme options.

---

## Technical Notes

### selectedTicker state in priceStore (Task 1)

Add `selectedTicker` to the existing `usePriceStore`:

```ts
// Add to PriceState interface:
selectedTicker: string
selectTicker: (ticker: string) => void

// Default value:
selectedTicker: 'AAPL',
selectTicker: (ticker: string) => set({ selectedTicker: ticker }),
```

This keeps ticker selection co-located with price data. Use granular selectors: `usePriceStore(s => s.selectedTicker)`.

### WatchlistRow active state (Task 2)

In `WatchlistRow.tsx`:
- Read `selectedTicker` from store: `const isActive = usePriceStore(s => s.selectedTicker === ticker)`
- Add click handler: `onClick={() => usePriceStore.getState().selectTicker(ticker)}`
- Conditionally apply active style: `border-l-2 border-blue-primary` when active, `border-l-2 border-transparent` when inactive
- Both states use `border-l-2` so layout doesn't shift on selection change

### MainChart component (Task 3)

Location: `frontend/src/components/layout/MainChart.tsx`

- `'use client'` directive required
- Props: none (reads from store)
- Read selected ticker: `const ticker = usePriceStore(s => s.selectedTicker)`
- Read sparkline points: `const points = usePriceStore(s => s.sparklines[ticker] ?? EMPTY_POINTS)`
  - Use `EMPTY_POINTS` module-level constant (same pattern as WatchlistRow — prevents Zustand re-render loop)

**Chart creation** (`useEffect` with empty deps, cleanup via `chart.remove()`):
```ts
import { createChart, LineSeries, ColorType } from 'lightweight-charts'

const chart = createChart(containerRef.current, {
  layout: {
    background: { type: ColorType.Solid, color: '#0d1117' },
    textColor: '#8b949e',
  },
  grid: {
    vertLines: { color: '#30363d' },
    horzLines: { color: '#30363d' },
  },
  crosshair: {
    vertLine: { color: '#30363d', labelBackgroundColor: '#753991' },
    horzLine: { color: '#30363d', labelBackgroundColor: '#753991' },
  },
  rightPriceScale: { borderColor: '#30363d' },
  timeScale: { borderColor: '#30363d' },
})

const series = chart.addSeries(LineSeries, {
  color: '#209dd7',
  lineWidth: 2,
  priceLineVisible: true,
  lastValueVisible: true,
})
```

Store `chart` and `series` in refs (`useRef`) so the data-update effect can access them.

**Data updates** (`useEffect` watching `points` and `ticker`):
- Call `series.setData(points)` to replace all data on ticker switch
- Call `chart.timeScale().fitContent()` after setting data
- For real-time appending on same ticker: `series.update(point)` appends the latest point without full reset

**Distinguishing ticker switch vs new data point**: Track `ticker` in a ref. When ticker changes → `setData(points)` (full reset). When ticker is same but points grew → `update(lastPoint)` (append).

### ResizeObserver integration (Task 4)

Inside the chart-creation `useEffect`:
```ts
const observer = new ResizeObserver((entries) => {
  const { width, height } = entries[0].contentRect
  chart.resize(width, height)
})
observer.observe(containerRef.current)
// Cleanup: observer.disconnect()
```

The container div must have `width: 100%; height: 100%` (via Tailwind `w-full h-full`) so it fills the `CenterPanel` flex child.

### CenterPanel update (Task 5)

Replace the stub in `CenterPanel.tsx`:
```tsx
import MainChart from './MainChart'

export default function CenterPanel() {
  return (
    <section className="flex-1 bg-background overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0">
        <MainChart />
      </div>
      {/* TODO: TabStrip + TradeBar (Story 2.x) */}
    </section>
  )
}
```

`min-h-0` is required on the flex child to allow the chart to shrink properly in a flex column layout.

---

## Previous Story Intelligence

From Story 1.4 dev agent record — critical patterns to follow:

1. **LightweightCharts v5 API**: Use `chart.addSeries(LineSeries, {...})` — NOT the v4 `addLineSeries()` method
2. **`EMPTY_POINTS` constant**: Always use a module-level `const EMPTY_POINTS: SparklinePoint[] = []` when providing default values in Zustand selectors to prevent infinite re-render loops. Using `?? []` inline creates a new array reference every render.
3. **LightweightCharts mock in tests**: jsdom has no canvas. Mock `lightweight-charts` module returning `{ addSeries: fn, remove: fn, resize: fn, timeScale: fn, applyOptions: fn }`.
4. **Components directory**: All layout components go in `frontend/src/components/layout/`
5. **`SparklinePoint` type**: Already exported from `priceStore.ts` as `{ time: number; value: number }` — reuse it, don't recreate

---

## Tasks

- [x] **Task 1 — Add selectedTicker to priceStore**
  - [x] Add `selectedTicker: string` (default `'AAPL'`) and `selectTicker` action to `PriceState` interface and store
  - [x] Update `priceStore.test.ts` — test default value is `'AAPL'`, test `selectTicker` updates state

- [x] **Task 2 — WatchlistRow active state + click handler**
  - [x] Read `selectedTicker` from store, derive `isActive` boolean
  - [x] Add `onClick` calling `selectTicker(ticker)`
  - [x] Apply `border-l-2 border-blue-primary` when active, `border-l-2 border-transparent` when inactive
  - [x] Update `WatchlistRow.test.tsx` — test active border on matching ticker, test click calls `selectTicker`, test inactive border on non-matching ticker

- [x] **Task 3 — MainChart component**
  - [x] Create `frontend/src/components/layout/MainChart.tsx`
  - [x] Chart creation with full dark theme config (background, grid, crosshair, axis colors)
  - [x] LineSeries with `color: '#209dd7'`, `lineWidth: 2`
  - [x] Data effect: `setData(points)` on ticker switch, `update(lastPoint)` on new data for same ticker
  - [x] `chart.timeScale().fitContent()` after data set
  - [x] Store chart/series in refs for cross-effect access
  - [x] Unit tests: renders container div, handles empty points, mock lightweight-charts verifying `createChart` called with dark theme options, `addSeries` called with LineSeries

- [x] **Task 4 — ResizeObserver on MainChart**
  - [x] Add `ResizeObserver` in chart-creation effect, calling `chart.resize(width, height)`
  - [x] Cleanup: `observer.disconnect()` alongside `chart.remove()`
  - [x] Container div uses `w-full h-full`
  - [x] Unit test: verify ResizeObserver is constructed and observes the container element

- [x] **Task 5 — Update CenterPanel to render MainChart**
  - [x] Import and render `<MainChart />` inside a `flex-1 min-h-0` wrapper div
  - [x] Keep TODO comment for TabStrip + TradeBar (Story 2.x)
  - [x] Unit test: CenterPanel renders MainChart component

---

## Dev Agent Record

### Implementation Notes
- `selectedTicker` and `selectTicker` added to existing `usePriceStore` — co-located with price data since the MainChart reads sparklines by selected ticker. Default is `'AAPL'` per AC1.
- `WatchlistRow` uses `border-l-2` on both active and inactive states to prevent layout shift when selection changes. `border-blue-primary` vs `border-transparent`.
- `MainChart` uses two `useEffect` hooks: one for chart creation + ResizeObserver (empty deps), one for data updates (watching `ticker` + `points`). Chart and series stored in refs for cross-effect access.
- Data update logic distinguishes ticker switch (`setData` full reset + `fitContent`) from new price arrival (`update` single point append) using a `prevTickerRef`. This avoids resetting the chart view on every SSE event.
- `EMPTY_POINTS` module-level constant used in MainChart (same pattern as WatchlistRow from Story 1.4) to prevent Zustand infinite re-render loop.
- `CenterPanel` wraps MainChart in `flex-1 min-h-0` — the `min-h-0` is required to allow flex children to shrink below their content size in a column flex layout.
- LightweightCharts v5 mock in tests uses class-based `MockResizeObserver` (not `vi.fn()`) because jsdom requires `new ResizeObserver()` constructor syntax.
- 53/53 tests pass, 0 regressions.

### Files Changed
- `frontend/src/stores/priceStore.ts` — added `selectedTicker`, `selectTicker`
- `frontend/src/stores/priceStore.test.ts` — 2 new tests for selectedTicker
- `frontend/src/components/layout/WatchlistRow.tsx` — active border + click handler
- `frontend/src/components/layout/WatchlistRow.test.tsx` — 3 new tests for active state
- `frontend/src/components/layout/MainChart.tsx` *(new)* — full-size chart with dark theme
- `frontend/src/components/layout/MainChart.test.tsx` *(new)* — 8 tests
- `frontend/src/components/layout/CenterPanel.tsx` — renders MainChart
- `frontend/src/components/layout/CenterPanel.test.tsx` *(new)* — 2 tests
