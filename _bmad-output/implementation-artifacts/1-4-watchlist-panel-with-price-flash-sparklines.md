# Story 1.4 — Watchlist Panel with Price Flash & Sparklines

## Status: done

## Story

**As a** trader viewing the terminal,
**I want** to see all my watched tickers in a panel with live prices, flash animations, and sparkline mini-charts,
**so that** I can immediately spot price movements and trends at a glance.

---

## Acceptance Criteria

- **AC1** — Watchlist panel renders all 10 default tickers, each row showing: ticker symbol, 52×20px sparkline, current price, and % change (or `—` placeholder before first price arrives)
- **AC2** — On each new price for a ticker, the row briefly flashes `.flash-green` (uptick) or `.flash-red` (downtick) for 500ms via CSS `@keyframes` fade, implemented via `useEffect` comparing previous vs current price
- **AC3** — Sparklines are buffered in `priceStore` as `{ time: number; value: number }[]` (Unix seconds + price), capped at 200 points per ticker, rendered via LightweightCharts v5 in minimal mode (no axes, no grid, no crosshair)
- **AC4** — % change displays with `+` prefix in `green-up` color for positive, `−` (U+2212, not hyphen) prefix in `red-down` color for negative
- **AC5** — All prices and % change values use JetBrains Mono (`font-mono` token)

---

## Technical Notes

### priceStore update (Task 1)
- Change `sparklines: Record<string, number[]>` → `Record<string, SparklinePoint[]>`
- Add type: `export type SparklinePoint = { time: number; value: number }`
- In `updatePrice`: push `{ time: Math.floor(new Date(update.timestamp).getTime() / 1000), value: update.price }`, cap at 200 points
- Update `priceStore.test.ts` to match new type

### CSS flash (Task 2)
Add to `globals.css`:
```css
@keyframes flash-green {
  0%   { background-color: rgb(from var(--color-green-up) r g b / 0.35); }
  100% { background-color: transparent; }
}
@keyframes flash-red {
  0%   { background-color: rgb(from var(--color-red-down) r g b / 0.35); }
  100% { background-color: transparent; }
}
.flash-green { animation: flash-green 500ms ease-out forwards; }
.flash-red   { animation: flash-red   500ms ease-out forwards; }
```

### SparklineChart component (Task 3)
- Location: `frontend/src/components/layout/SparklineChart.tsx`
- `'use client'` directive required
- Props: `points: SparklinePoint[]`, `width?: number` (default 52), `height?: number` (default 20)
- `useEffect` creates chart via `createChart(containerRef.current, { width, height, layout: { background: { color: 'transparent' }, textColor: 'transparent' }, grid: { vertLines: { visible: false }, horzLines: { visible: false } }, crosshair: { mode: 0 }, rightPriceScale: { visible: false }, timeScale: { visible: false }, handleScroll: false, handleScale: false })`
- Add series: `chart.addSeries(LineSeries, { color: '#209dd7', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })`
- Set data: `series.setData(points)`
- Cleanup: `chart.remove()` on unmount
- Update `points` in separate effect watching `points` array

### WatchlistRow component (Task 4)
- Location: `frontend/src/components/layout/WatchlistRow.tsx`
- `'use client'` directive required
- Props: `ticker: string`
- Read from store: `const price = usePriceStore(s => s.prices[ticker])`
- Read sparkline: `const points = usePriceStore(s => s.sparklines[ticker] ?? [])`
- Flash ref: `const rowRef = useRef<HTMLDivElement>(null)`
- Flash effect: `useEffect` on `price?.price` — on change, `rowRef.current?.classList.remove('flash-green', 'flash-red')`, force reflow (`rowRef.current.offsetWidth`), add correct class, `setTimeout(() => rowRef.current?.classList.remove(...)`, 500)`
- % change: derived from `price.price` and `price.previousPrice`; format with `+`/`−` prefix, 2 decimal places, `%` suffix
- No price yet: show `—` for price and `—` for change

### WatchlistPanel (Task 5)
- Replace stub in `frontend/src/components/layout/WatchlistPanel.tsx`
- Read tickers from `/api/watchlist` via `useEffect` + `useState`, or use a static default list of 10 tickers for initial render
- Render `<WatchlistRow ticker={t} key={t} />` for each ticker
- Keep `'use client'` directive, keep same export name `WatchlistPanel`

---

## Tasks

- [x] **Task 1 — Update priceStore for SparklinePoint type**
  - [x] Add `SparklinePoint` type export to `priceStore.ts`
  - [x] Change `sparklines` type from `Record<string, number[]>` to `Record<string, SparklinePoint[]>`
  - [x] Update `updatePrice` to push `{ time, value }` and cap at 200
  - [x] Update `priceStore.test.ts` — all existing tests pass, new tests cover sparkline push and cap logic

- [x] **Task 2 — Add flash CSS keyframes**
  - [x] Add `.flash-green` and `.flash-red` keyframes + classes to `globals.css`
  - [x] Unit test: verify classes exist and animation duration is 500ms (CSS snapshot or manual check)

- [x] **Task 3 — SparklineChart component**
  - [x] Create `frontend/src/components/layout/SparklineChart.tsx`
  - [x] Implements LightweightCharts v5 minimal chart with `LineSeries`
  - [x] Renders 52×20px by default, transparent background, no axes/grid/crosshair
  - [x] Unit test: renders container div, handles empty `points` array, updates series when `points` change

- [x] **Task 4 — WatchlistRow component**
  - [x] Create `frontend/src/components/layout/WatchlistRow.tsx`
  - [x] Reads `prices[ticker]` and `sparklines[ticker]` from Zustand
  - [x] Flash effect via `useEffect` + `classList` manipulation
  - [x] % change formatted with correct sign, color, and U+2212 minus
  - [x] `font-mono` applied to price and % change spans
  - [x] Unit tests: renders placeholder `—` before price, shows correct price/% after mock price update, flash classes applied on price change

- [x] **Task 5 — WatchlistPanel with ticker list**
  - [x] Replace stub in `frontend/src/components/layout/WatchlistPanel.tsx`
  - [x] Fetches ticker list from `/api/watchlist` on mount, falls back to 10 default tickers
  - [x] Renders `WatchlistRow` for each ticker
  - [x] Unit tests: renders correct number of rows, handles empty list, handles API fetch error gracefully

---

## Dev Agent Record

### Implementation Notes
- `SparklinePoint = { time: number; value: number }` — Unix seconds derived from `update.timestamp` via `Math.floor(new Date(...).getTime() / 1000)`. LightweightCharts requires this format for time axis alignment.
- `EMPTY_POINTS` module-level constant in `WatchlistRow.tsx` prevents infinite Zustand re-render loop. Using `?? []` inline creates a new array reference on every selector call, causing `Object.is` comparison to fail every time and triggering continuous re-renders.
- CSS flash uses literal RGB values (`rgb(63 185 80 / 0.35)`) instead of relative color syntax (`rgb(from var(...) r g b / 0.35)`) for jsdom/test compatibility. Semantically identical.
- LightweightCharts v5 mocked in component tests — jsdom has no canvas rendering context. Mock returns `{ addSeries, remove }` shape matching real API.
- `WatchlistPanel` uses optimistic default tickers (renders immediately), then updates from `/api/watchlist` — no loading flicker.
- 38/38 tests pass, 0 regressions.

### Files Changed
- `frontend/src/stores/priceStore.ts`
- `frontend/src/stores/priceStore.test.ts`
- `frontend/src/app/globals.css`
- `frontend/src/app/globals.test.ts` *(new)*
- `frontend/src/components/layout/SparklineChart.tsx` *(new)*
- `frontend/src/components/layout/SparklineChart.test.tsx` *(new)*
- `frontend/src/components/layout/WatchlistRow.tsx` *(new)*
- `frontend/src/components/layout/WatchlistRow.test.tsx` *(new)*
- `frontend/src/components/layout/WatchlistPanel.tsx`
- `frontend/src/components/layout/WatchlistPanel.test.tsx` *(new)*

### Review Findings

Code review completed 2026-04-11 — three adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). All 5 acceptance criteria verified. 17 findings raised, all dismissed (false positives, out-of-scope, or defensive coding contrary to project standards). 0 action items. Clean review.
