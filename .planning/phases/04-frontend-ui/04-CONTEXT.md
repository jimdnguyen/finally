---
phase: 04-frontend-ui
created: 2026-04-10
status: ready_for_research
---

# Phase 04: Frontend UI — Discussion Context

Decisions made during discuss-phase for Phase 4. These lock in key architectural choices for the
researcher, planner, and executor agents.

---

## D-01: Next.js Router Strategy

**Decision:** App Router (Next.js 15 default)

**Rationale:** User did not raise App Router vs Pages Router as a concern — App Router is the
modern Next.js 15 standard and works correctly with `output: 'export'` static mode. Single root
page at `app/page.tsx` with a root layout at `app/layout.tsx`.

**Impact:**
- Directory: `frontend/app/` (not `frontend/pages/`)
- Client components marked with `'use client'` where needed (EventSource, Zustand)
- Server components only at layout level; all data-driven components are client components
- Static export config: `next.config.js` with `output: 'export'`

---

## D-02: Panel Layout — 3-Column Grid

**Decision:** 3-column fixed layout with header spanning full width

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Logo | Portfolio value | [Ticker][Qty][BUY][SELL] ● │
├──────────┬───────────────────────────┬─────────────────────┤
│ WATCHLIST│     Main Chart            │   AI Chat sidebar   │
│ AAPL ~~~ │                           │ conversation history │
│ GOOGL ~~~│───────────────────────────│                     │
│ MSFT  ~~~│ Heatmap  |  P&L Chart     │                     │
│ TSLA  ~~~│───────────────────────────│ [message input]     │
│ NVDA  ~~~│ Positions Table           │ [Send]              │
└──────────┴───────────────────────────┴─────────────────────┘
```

**Column widths (approximate):** Watchlist 220px | Center flex-1 | Chat 300px

**Trade bar:** In the header — ticker field, quantity field, BUY button (blue `#209dd7`),
SELL button. Clicking a ticker in the watchlist autofills the ticker field.

**Center column sections (top to bottom):**
1. Main chart (selected ticker price history, tall, ECharts line chart)
2. Portfolio row: Heatmap (treemap, ECharts) + P&L chart (line, ECharts) side by side
3. Positions table (ticker, qty, avg cost, current price, P&L, % change)

**Chat sidebar:** Fixed right column. Always visible. Scrollable message history. Input at bottom.
Trade confirmations and watchlist changes shown as inline assistant messages.

---

## D-03: SSE State Architecture — Zustand Singleton

**Decision:** Single Zustand store for all price state. One `usePriceStream` hook initialized at
root layout. Browser native `EventSource` auto-retry handles reconnection.

**Store shape:**
```typescript
// frontend/store/priceStore.ts
interface PriceState {
  prices: Record<string, PriceUpdate>   // latest price per ticker
  history: Record<string, number[]>     // sparkline: 60 price points per ticker
  status: 'connecting' | 'live' | 'reconnecting'  // SSE connection status
  setPrice: (ticker: string, update: PriceUpdate) => void
  setStatus: (status: PriceState['status']) => void
}
```

**EventSource lifecycle:**
- Created in `usePriceStream()` hook called once at `app/layout.tsx`
- `onmessage` → `setPrice()` + append to history (cap at 60 points)
- `onopen` → `setStatus('live')`
- `onerror` → `setStatus('reconnecting')` (browser auto-retries via `retry: 1000` SSE header)
- No manual reconnection jitter needed

**Component usage (selectors prevent unnecessary re-renders):**
```typescript
const price = usePriceStore(s => s.prices[ticker])
const history = usePriceStore(s => s.history[ticker])
const status = usePriceStore(s => s.status)
```

**Selected ticker (for main chart):** Stored in a separate Zustand slice or local state in
the root page component — not in the price store. Watchlist click updates it; default is first
watchlist ticker.

---

## D-04: Price Flash Animation

**Decision:** CSS class toggle via React state

Each watchlist row tracks `direction` ('up'/'down'/'flat') from the incoming `PriceUpdate`.
On new price arrival, apply `.flash-up` or `.flash-down` class for ~500ms via `setTimeout`,
then remove. Tailwind `transition-colors duration-500` handles the fade.

```typescript
// No animation library needed — just class toggle + timeout
const [flash, setFlash] = useState<'up' | 'down' | null>(null)
useEffect(() => {
  if (!price) return
  setFlash(price.direction === 'up' ? 'up' : 'down')
  const t = setTimeout(() => setFlash(null), 500)
  return () => clearTimeout(t)
}, [price?.price])
```

**Colors:** flash-up → brief `bg-green-500/20`, flash-down → brief `bg-red-500/20`

---

## D-05: Frontend Testing — Vitest + React Testing Library

**Decision:** Include component tests in Phase 4 alongside the UI work.

**Setup:** Vitest (not Jest) — native ESM support, faster, matches Next.js 15 ecosystem.
React Testing Library for component rendering and interaction.

**What to test:**
- Price flash animation: direction change triggers correct CSS class
- Trade form validation: empty ticker / zero quantity shows error, valid input enables buttons
- Chat message rendering: user vs assistant messages render correctly, loading state shows
- Watchlist row: renders ticker, price, change %, sparkline
- Connection status indicator: shows correct color for each status value

**What NOT to test in unit tests:**
- ECharts rendering (visual only, test in E2E)
- SSE connection itself (integration concern)
- TanStack Query fetching (mock at the API boundary)

---

## D-06: ECharts Usage

**Decision:** `echarts` + `echarts-for-react` wrapper

**Three chart types:**
1. **Sparklines** (watchlist): Mini line charts, no axes, no tooltip, 60 points, height ~32px
2. **Main chart**: Full line chart with time axis, tooltip, zoom. Price history accumulated
   from SSE since page load (same 60-point sparkline data, or extended history from a dedicated
   store slice).
3. **Heatmap / Treemap**: Portfolio positions sized by weight, colored by P&L. ECharts treemap
   type. Green = profit (`#22c55e`), Red = loss (`#ef4444`). Neutral = `#374151`.
4. **P&L line chart**: Portfolio value over time from `GET /api/portfolio/history`.
   Polls every 30s via TanStack Query.

---

## D-07: TanStack Query Usage

**Decision:** TanStack Query (`@tanstack/react-query`) for all REST API calls (not SSE).

**Queries:**
- `GET /api/portfolio` — portfolio positions, cash, total value (refetch after trades)
- `GET /api/portfolio/history` — P&L snapshots (poll every 30s)
- `GET /api/watchlist` — initial watchlist load

**Mutations:**
- `POST /api/portfolio/trade` — buy/sell; on success invalidate portfolio query
- `POST /api/watchlist` — add ticker; on success invalidate watchlist
- `DELETE /api/watchlist/{ticker}` — remove ticker; on success invalidate watchlist
- `POST /api/chat` — send message; append response to local chat state

**QueryClient:** initialized in root layout, `QueryClientProvider` wraps app.

---

## D-08: Color Scheme & Tailwind Config

**Locked palette (from PLAN.md):**
| Token | Hex | Usage |
|-------|-----|-------|
| `bg-base` | `#0d1117` | Page background |
| `bg-panel` | ~`#161b22` | Panel backgrounds |
| `accent-yellow` | `#ecad0a` | Logo, highlights |
| `blue-primary` | `#209dd7` | BUY button, links, primary actions |
| `purple-submit` | `#753991` | SELL button, submit/destructive actions |
| `green-up` | `#22c55e` | Price up, P&L positive |
| `red-down` | `#ef4444` | Price down, P&L negative |

**Tailwind config:** Extend theme with custom colors mapped to above tokens. Dark mode via
`darkMode: 'class'` with `dark` class on `<html>` (always dark — no light mode toggle).

---

## D-09: Next.js Project Initialization

**Command:**
```bash
cd finally
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

**Then configure static export in `next.config.js`:**
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
}
module.exports = nextConfig
```

**Additional packages to install:**
```bash
cd frontend
npm install zustand @tanstack/react-query echarts echarts-for-react
npm install --save-dev vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

---

## Deferred Ideas (out of scope for Phase 4)

- **Responsive / mobile layout**: Desktop-first only; mobile layout deferred
- **Light mode / theme toggle**: Always dark
- **Websockets**: SSE is sufficient for one-way price push
- **Real-time chat streaming**: Chat returns complete JSON response (no token streaming)
- **Drag-to-resize panels**: Fixed column widths only
- **Multi-user / auth**: Single default user, no login UI
- **Playwright E2E tests**: Exist in `test/`; not added in Phase 4 (existing infrastructure)

---

## Requirements Coverage

Phase 4 delivers UI-01 through UI-17 from REQUIREMENTS.md, plus WTCH-02 and WTCH-03:

| Req | Description | Decisions Applied |
|-----|-------------|-------------------|
| UI-01 | Dark theme `#0d1117` | D-08 |
| UI-02 | Watchlist grid with live prices | D-03 (Zustand), D-04 (flash) |
| UI-03 | Sparkline mini-charts | D-03 (60-point history), D-06 (ECharts) |
| UI-04 | SSE EventSource with reconnect | D-03 |
| UI-05 | Connection status indicator | D-03 (status field) |
| UI-06 | Main ticker chart | D-06 (ECharts line) |
| UI-07 | Portfolio heatmap (treemap) | D-06 (ECharts treemap) |
| UI-08 | P&L chart | D-06, D-07 (30s poll) |
| UI-09 | Positions table | D-02 (center column) |
| UI-10 | Trade bar (buy/sell) | D-02 (header) |
| UI-11 | Trade auto-fills from watchlist click | D-02 |
| UI-12 | AI chat panel | D-02 (right column) |
| UI-13 | Chat trade confirmations inline | D-02 |
| UI-14 | Price flash animation | D-04 |
| UI-15 | Header: portfolio value + cash | D-02 |
| UI-16 | ECharts charting library | D-06 |
| UI-17 | Vitest + RTL component tests | D-05 |
| WTCH-02 | Add ticker via UI | D-07 (mutation) |
| WTCH-03 | Remove ticker via UI | D-07 (mutation) |
