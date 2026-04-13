# Story 2.6: Portfolio Heatmap

Status: done

## Story

As a **user who wants a visual overview of my portfolio**,
I want **a treemap heatmap showing positions sized by weight and colored by P&L**,
so that **I can instantly identify my biggest winners and losers**.

## Acceptance Criteria

1. **Given** the user has positions, **when** the `PortfolioHeatmap` renders, **then** each position is a `div` with `flex-basis` proportional to its weight (position value / total portfolio value).
2. **Given** a position has positive P&L, **when** the cell renders, **then** its background interpolates toward `green-up (#3fb950)` based on P&L%; negative P&L interpolates toward `red-down (#f85149)`.
3. **Given** the heatmap renders, **when** inspecting each cell, **then** it has `aria-label="TICKER +X.X%"` (or `−X.X%` with U+2212) for accessibility.
4. **Given** the user has no positions, **when** the heatmap renders, **then** it shows muted text: "No positions — buy something to get started".
5. **Given** prices update via SSE, **when** `priceStore` updates, **then** heatmap cell sizes and colors update live without requiring a portfolio refetch.

## Tasks / Subtasks

- [x] Task 1: Create `PortfolioHeatmap` component (AC: 1, 2, 3, 4, 5)
  - [x] 1.1 Create `frontend/src/components/layout/PortfolioHeatmap.tsx` — a `'use client'` component that reads positions from `usePortfolioStore` and live prices from `usePriceStore`
  - [x] 1.2 Calculate live P&L per position: `livePrice = usePriceStore(s => s.prices[ticker]?.price) ?? position.current_price`, then `pnlPct = ((livePrice - avg_cost) / avg_cost) * 100` and `positionValue = livePrice * quantity` — same pattern as `PositionsTable.tsx:PositionRow`
  - [x] 1.3 Calculate `totalValue` as sum of all `positionValue` entries; each cell gets `flex-basis: (positionValue / totalValue * 100)%`
  - [x] 1.4 Implement color interpolation: neutral base `#2d333b` (surface), interpolate toward `#3fb950` (green-up) for positive P&L% and `#f85149` (red-down) for negative P&L%. Clamp at a reasonable max (e.g., +/-20% maps to full saturation). Use a simple linear lerp between neutral and target color in RGB space.
  - [x] 1.5 Each cell renders: ticker symbol (white, `text-xs font-semibold`), P&L% below (`text-xs font-mono`), with `aria-label="TICKER +X.X%"` (U+2212 for negative). Format sign per UX-DR20: `+` for positive, `−` (U+2212) for negative.
  - [x] 1.6 Empty state: when `positions.length === 0`, render centered muted text `"No positions — buy something to get started"` — exact same message as PositionsTable empty state (UX-DR17).
  - [x] 1.7 Container: `flex flex-wrap` with `min-h-0 h-full overflow-hidden`. Each cell should have `min-w-[60px]` to prevent cells from becoming too narrow to read.

- [x] Task 2: Write tests for `PortfolioHeatmap` (AC: 1, 2, 3, 4, 5)
  - [x] 2.1 Create `frontend/src/components/layout/PortfolioHeatmap.test.tsx`
  - [x] 2.2 Test empty state: no positions renders "No positions — buy something to get started"
  - [x] 2.3 Test cell rendering: 2 positions → 2 cells with correct ticker text and aria-labels
  - [x] 2.4 Test flex-basis proportionality: position A worth $600, position B worth $400 → flex-basis ~60% and ~40%
  - [x] 2.5 Test P&L sign formatting: positive shows `+`, negative shows `−` (U+2212), both in aria-label
  - [x] 2.6 Test live price update: set priceStore price → verify cell recalculates P&L and weight

- [x] Task 3: Integrate into CenterPanel (AC: 1)
  - [x] 3.1 Import `PortfolioHeatmap` into `CenterPanel.tsx` and render it in the bottom panel area alongside `PositionsTable`. For now, render it directly above PositionsTable in the existing bottom section. Story 2.7 will introduce the `TabStrip` that switches between Heatmap / Positions / P&L History.
  - [x] 3.2 Adjust the bottom panel in CenterPanel: increase height from `h-48` to `h-64` to accommodate both the heatmap and positions table, or use a split layout with heatmap taking ~40% and positions table ~60% of the bottom space.

- [x] Task 4: Full regression test run
  - [x] 4.1 Run ALL frontend tests — existing + new must pass
  - [x] 4.2 Run ALL backend tests (`uv run --extra dev pytest -v`) — ensure no regressions

## Dev Notes

### Architecture Compliance

**Custom div-based treemap** — the spec explicitly says NO charting library for the heatmap. Use CSS `flex-wrap` with `flex-basis` proportional to position weight. [Source: UX-DR8, ux-design-specification.md — "Custom `div`-based layout using CSS `flex-wrap`"]

**Component location**: `components/layout/PortfolioHeatmap.tsx` — follows existing pattern where all layout components live in `components/layout/` flat structure.

**Live P&L from priceStore (AC-5)**: Each heatmap cell subscribes to `usePriceStore` for its ticker's live price — same pattern as `PositionsTable.tsx:PositionRow` (lines 23-29). This means cells update on every SSE price tick without refetching the portfolio API. The portfolio API provides `avg_cost` and `quantity`; live price comes from priceStore.

### Color Interpolation Algorithm

Interpolate in RGB space between a neutral base and the target color:

```typescript
function interpolateColor(pnlPct: number): string {
  const maxPct = 20 // full saturation at +-20%
  const t = Math.min(Math.abs(pnlPct) / maxPct, 1)
  // neutral: #2d333b → rgb(45, 51, 59)
  // green:   #3fb950 → rgb(63, 185, 80)
  // red:     #f85149 → rgb(248, 81, 73)
  const neutral = [45, 51, 59]
  const target = pnlPct >= 0 ? [63, 185, 80] : [248, 81, 73]
  const r = Math.round(neutral[0] + (target[0] - neutral[0]) * t)
  const g = Math.round(neutral[1] + (target[1] - neutral[1]) * t)
  const b = Math.round(neutral[2] + (target[2] - neutral[2]) * t)
  return `rgb(${r}, ${g}, ${b})`
}
```

### P&L Sign Formatting (UX-DR20)

Always explicit sign: `+` for positive, `−` (U+2212, not hyphen) for negative. Color alone never conveys direction. Reuse the same pattern from `PositionsTable.tsx:formatPct`.

### Color Usage Rules (UX-DR21)

- Green (`#3fb950`) — positive P&L only
- Red (`#f85149`) — negative P&L only
- No other colors for heatmap cells; text inside cells is white (`text-primary`)

### Empty State (UX-DR17)

Exact text: `"No positions — buy something to get started"` — muted text, centered, no illustrations, no icons. Same message as PositionsTable.

### TabStrip Context (Story 2.7)

Story 2.7 introduces a `TabStrip` below the MainChart with tabs: Heatmap / Positions / P&L History. For now in Story 2.6, just render the heatmap alongside PositionsTable in the bottom section. Story 2.7 will refactor CenterPanel to use tab switching. Do NOT build the TabStrip in this story.

### Existing Code to Reuse (DO NOT reinvent)

- **`PositionsTable.tsx:PositionRow`** — live price subscription pattern: `usePriceStore(s => s.prices[ticker]?.price)`, fallback to `position.current_price`, P&L calc
- **`PositionsTable.tsx:formatPnl/formatPct`** — sign formatting with U+2212. Consider extracting if needed, but copying the 5-line function is fine too.
- **`usePortfolioStore`** — `portfolio?.positions ?? EMPTY_POSITIONS` selector pattern with stable fallback (Learning #25)
- **`usePriceStore`** — per-ticker price subscription
- **`Position` type** (`types/index.ts`) — `{ ticker, quantity, avg_cost, current_price, unrealized_pnl, pnl_pct }`
- **Design tokens**: `text-text-primary`, `text-text-muted`, `bg-surface`, `green-up`, `red-down`

### Testing Pattern

- Co-located test file: `PortfolioHeatmap.test.tsx`
- Mock stores: `usePortfolioStore.setState({ portfolio: { ... } })` and `usePriceStore.setState({ prices: { ... } })`
- Test flex-basis via `style` attribute on rendered cells
- Test aria-labels via `getByLabelText` or `getAttribute('aria-label')`
- Test color via inline `style.backgroundColor`

### CRITICAL: Read Next.js Docs First

The `frontend/AGENTS.md` warns: *"This is NOT the Next.js you know."* Check `node_modules/next/dist/docs/` for breaking changes before modifying client components.

### Project Structure Notes

- `frontend/src/components/layout/PortfolioHeatmap.tsx` — NEW: Heatmap component
- `frontend/src/components/layout/PortfolioHeatmap.test.tsx` — NEW: Tests
- `frontend/src/components/layout/CenterPanel.tsx` — MODIFY: Add heatmap to bottom panel

### Previous Story Intelligence (2.5)

- **Stable fallback constants**: Use `const EMPTY_POSITIONS: Position[] = []` at module level — never inline `?? []` in selectors (Learning #25, zustand-selector-stability)
- **getState() in async callbacks**: Not needed here (no async), but remember for any event handlers
- **Fallback values that destroy state**: `.catch(() => [])` vs `.catch(() => null)` (Learning #32) — relevant if any async work is added

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 2.6 acceptance criteria, FR17]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — UX-DR8 PortfolioHeatmap, UX-DR17 empty states, UX-DR20 P&L sign rule, UX-DR21 color usage]
- [Source: _bmad-output/planning-artifacts/epics.md — UX-DR11 TabStrip (Story 2.7 context)]
- [Source: frontend/src/components/layout/PositionsTable.tsx — live P&L calculation pattern, formatPnl/formatPct]
- [Source: frontend/src/stores/portfolioStore.ts — Portfolio state shape]
- [Source: frontend/src/stores/priceStore.ts — per-ticker price subscription]
- [Source: frontend/src/types/index.ts — Position, Portfolio types]
- [Source: frontend/src/components/layout/CenterPanel.tsx — current layout: MainChart + TradeBar + PositionsTable]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered.

### Completion Notes List

- Task 1: Created `PortfolioHeatmap.tsx` — custom div-based treemap using CSS `flex-wrap` with `flex-basis` proportional to position weight. Each `HeatmapCell` subscribes to `usePriceStore` for live price, calculates P&L% and position value reactively. Color interpolation via linear RGB lerp between neutral `#2d333b` and `green-up`/`red-down`, clamped at ±20%. Parent also subscribes to `prices` for reactive weight recalculation. Empty state shows UX-DR17 message. Aria-labels with U+2212 for negative P&L (UX-DR20).
- Task 2: 7 tests covering empty state (null portfolio + empty positions array), cell rendering (2 positions → correct ticker text), flex-basis proportionality (69%/31% split), P&L sign formatting (+ and U+2212 in aria-labels), and live price update (priceStore change → recalculated weight and P&L).
- Task 3: Integrated into `CenterPanel.tsx` — bottom panel increased from `h-48` to `h-64`, split into 40% heatmap / 60% positions table with border-b separator. Updated CenterPanel test: added PortfolioHeatmap mock, added 2 new tests (renders heatmap, bottom panel has border-t), adjusted existing PositionsTable wrapper test.
- Task 4: Full regression — 99 frontend tests pass, 130 backend tests pass. Zero regressions.

### Change Log

- 2026-04-12: Story 2.6 implemented — Portfolio Heatmap with all ACs satisfied

### File List

- `frontend/src/components/layout/PortfolioHeatmap.tsx` — NEW: Custom div-based treemap heatmap component
- `frontend/src/components/layout/PortfolioHeatmap.test.tsx` — NEW: 7 tests for heatmap
- `frontend/src/components/layout/CenterPanel.tsx` — MODIFIED: Added heatmap to bottom panel (40/60 split with PositionsTable)
- `frontend/src/components/layout/CenterPanel.test.tsx` — MODIFIED: Added heatmap mock + 2 new tests, adjusted PositionsTable wrapper test
- `_bmad-output/implementation-artifacts/2-6-portfolio-heatmap.md` — MODIFIED: Status → review, tasks checked, dev record
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED: 2-6-portfolio-heatmap → review

### Review Findings

Code review completed 2026-04-12. Three-layer review (Blind Hunter, Edge Case Hunter, Acceptance Auditor) produced 21 raw findings. After deduplication (→17 unique) and triage: **0 decision-needed, 0 patch, 0 defer, 17 dismissed** (noise, false positives, already-guarded paths, or spec-compliant behavior). Clean review — all ACs satisfied.
