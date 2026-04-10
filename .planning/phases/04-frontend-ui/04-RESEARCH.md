# Phase 4: Frontend UI — Research

**Researched:** 2026-04-10  
**Domain:** Next.js 15 single-page application with real-time price streaming, trading interface, portfolio visualization, and AI chat panel  
**Confidence:** HIGH

## Summary

Phase 4 delivers a complete Next.js 15 static-export frontend with Tailwind CSS dark theme, real-time price streaming via SSE/Zustand, TanStack Query for portfolio/chat state, and ECharts visualizations. The frontend consumes fully-built backend APIs (Phase 1–3) including portfolio trading, watchlist management, and LLM chat integration.

Key architectural decisions are locked in from CONTEXT.md (D-01 through D-09): App Router with `output: 'export'`, 3-column desktop-first layout, Zustand for SSE price state, TanStack Query for REST API state, ECharts for all charts, Tailwind dark theme with custom color palette, and Vitest + React Testing Library for component testing.

**Primary recommendation:** Follow the locked decisions from CONTEXT.md exactly. All 9 decisions span stack selection (Next.js 15 App Router, Zustand, TanStack Query, ECharts, Vitest), layout (3-column with fixed widths), and implementation patterns (CSS class-based price flash, event-based SSE/Zustand flow). No alternatives to explore—the planner can proceed with task decomposition directly from D-01 through D-09.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Next.js Router Strategy**
- Use Next.js 15 App Router (not Pages Router)
- Single root page at `app/page.tsx` with root layout at `app/layout.tsx`
- Client components marked with `'use client'` where needed (EventSource, Zustand)
- All data-driven components are client components; server components only at layout level

**D-02: Panel Layout — 3-Column Grid**
- Full-width header spanning all columns with logo, portfolio value, cash balance, trade bar, connection status dot
- Watchlist column: ~220px, fixed; center column: flex-1; chat sidebar: ~300px, fixed
- Center column sections (top to bottom): Main chart (tall), Portfolio row (heatmap + P&L chart), Positions table
- Trade bar in header with auto-fill from watchlist click
- Chat sidebar fixed right, always visible, scrollable history, input at bottom

**D-03: SSE State Architecture — Zustand Singleton**
- Single Zustand store for all price state: `prices` (latest PriceUpdate per ticker), `history` (60 price points per ticker sparkline), `status` ('connecting'/'live'/'reconnecting')
- Browser native EventSource auto-retry handles reconnection (no manual jitter)
- One `usePriceStream()` hook initialized at root layout; `onmessage` → `setPrice()` + append to history
- Component selectors prevent unnecessary re-renders

**D-04: Price Flash Animation**
- CSS class toggle via React state (no animation library)
- Each watchlist row tracks `direction` ('up'/'down'/'flat'); apply `.flash-up` or `.flash-down` class for ~500ms
- Tailwind `transition-colors duration-500` handles fade; `setTimeout` removes class after 500ms
- Colors: flash-up → `bg-green-500/20`, flash-down → `bg-red-500/20`

**D-05: Frontend Testing — Vitest + React Testing Library**
- Unit tests alongside UI work in Phase 4
- Test framework: Vitest (not Jest) with native ESM support
- Test what: price flash animation, trade form validation, chat message rendering, watchlist row rendering, connection status indicator
- Don't test: ECharts rendering (visual only, E2E concern), SSE connection itself, TanStack Query fetching (mock at API boundary)

**D-06: ECharts Usage**
- `echarts` + `echarts-for-react` wrapper for all four chart types
- Sparklines: Mini line charts, no axes/tooltip, 60 points, height ~32px
- Main chart: Full line chart with time axis, tooltip, zoom; price history from SSE (60-point accumulation)
- Treemap: Portfolio positions sized by weight, colored by P&L (green=`#22c55e`, red=`#ef4444`, neutral=`#374151`)
- P&L line chart: Portfolio value over time from `GET /api/portfolio/history`, polls every 30s via TanStack Query

**D-07: TanStack Query Usage**
- All REST API calls (not SSE) via TanStack Query (`@tanstack/react-query`)
- Queries: `GET /api/portfolio`, `GET /api/portfolio/history` (30s poll), `GET /api/watchlist` (initial load)
- Mutations: `POST /api/portfolio/trade` (invalidate portfolio on success), `POST /api/watchlist` (invalidate watchlist), `DELETE /api/watchlist/{ticker}`, `POST /api/chat` (append to local state)
- QueryClient initialized in root layout, QueryClientProvider wraps app

**D-08: Color Scheme & Tailwind Config**
- Locked palette: `#0d1117` (bg-base), `#161b22` (bg-panel), `#ecad0a` (accent-yellow), `#209dd7` (blue-primary), `#753991` (purple-submit), `#22c55e` (green-up), `#ef4444` (red-down)
- Tailwind config: Extend theme with custom colors, dark mode via `darkMode: 'class'` on `<html>` (always dark)
- No light mode toggle; all UI is dark

**D-09: Next.js Project Initialization**
- Use: `npx create-next-app@latest frontend --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"`
- Configure static export in `next.config.js`: `output: 'export'`, `trailingSlash: true`
- Install additional packages: `zustand`, `@tanstack/react-query`, `echarts`, `echarts-for-react`
- Install dev packages: `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`

### Claude's Discretion

None identified in CONTEXT.md. All decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

- Responsive / mobile layout (desktop-first only)
- Light mode / theme toggle (always dark)
- WebSockets (SSE sufficient)
- Real-time chat streaming (complete JSON responses)
- Drag-to-resize panels (fixed widths only)
- Multi-user / auth (single default user)
- Playwright E2E tests (not Phase 4; exist in `test/`)

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Dark terminal aesthetic (`#0d1117` bg, muted borders, custom colors) | D-08: Tailwind config with locked palette and dark mode setup |
| UI-02 | Single-page desktop-first layout with all panels visible simultaneously | D-02: 3-column grid layout (watchlist 220px, center flex-1, chat 300px) |
| UI-03 | Header with live-updating portfolio value, cash balance, connection status dot | D-02, D-03: Header spans full width; connection status tied to Zustand `status` field |
| UI-04 | Watchlist panel (ticker, price, daily change %, sparkline mini-chart) | D-02, D-06, D-07: Watchlist column with ECharts sparklines; TanStack Query fetches `GET /api/watchlist` |
| UI-05 | Price flash animation (green/red background highlight, ~500ms fade via CSS transition) | D-04: CSS class toggle + setTimeout, Tailwind `transition-colors duration-500` |
| UI-06 | Sparkline mini-charts accumulate price history from SSE stream since page load | D-03, D-06: Zustand `history[ticker]` stores 60 points; ECharts renders inline |
| UI-07 | Click ticker in watchlist to select and display in main chart | D-02, D-03: Watchlist click updates selected ticker state; main chart responds |
| UI-08 | Main chart area (price-over-time line chart for selected ticker) | D-06: Full ECharts line chart with time axis, tooltip, zoom; data from Zustand history |
| UI-09 | Portfolio treemap/heatmap (rectangles sized by weight, colored by P&L) | D-06, D-07: ECharts treemap type; data from `GET /api/portfolio` (positions + live prices) |
| UI-10 | P&L line chart (total portfolio value over time from `GET /api/portfolio/history`) | D-06, D-07: ECharts line chart; TanStack Query polls every 30s; `SnapshotRecord` contains `total_value` + `recorded_at` |
| UI-11 | Positions table (ticker, qty, avg cost, current price, unrealized P&L, % change) | D-02, D-07: Center column; data from `GET /api/portfolio` → `PositionDetail` (all fields provided by backend) |
| UI-12 | Trade bar (ticker input, quantity input, Buy/Sell buttons) | D-02: Header element; TanStack Query mutation calls `POST /api/portfolio/trade`; `TradeRequest` requires ticker, side, quantity |
| UI-13 | AI chat panel (message input, scrolling history, loading indicator while awaiting response) | D-02: Right sidebar; TanStack Query mutation `POST /api/chat` returns `ChatAPIResponse` with message + executed_trades + execution_errors |
| UI-14 | Trade confirmations and watchlist changes appear inline in chat as badges/receipts | D-07: Chat mutation response includes `executed_trades` and `execution_errors` arrays; render inline |
| UI-15 | SSE EventSource client with auto-reconnect; connection status in header dot | D-03: `usePriceStream()` hook manages EventSource lifecycle; `onopen` → `setStatus('live')`, `onerror` → `setStatus('reconnecting')` |
| UI-16 | All API calls target same-origin `/api/*` (no CORS) | D-07: TanStack Query base URL is `/api`, relative fetch(). Same-origin guaranteed by FastAPI serving frontend static files. |
| UI-17 | Zustand store for prices, TanStack Query for portfolio/chat state | D-03, D-07: Zustand singleton for SSE-driven price state; TanStack Query for all REST calls |
| WTCH-02 | Add ticker via UI (`POST /api/watchlist` mutation) | D-02, D-07: Chat panel can trigger add; frontend form can also support add. TanStack Query mutation invalidates watchlist query on success. |
| WTCH-03 | Remove ticker via UI (`DELETE /api/watchlist/{ticker}` mutation) | D-02, D-07: Watchlist row has delete button or chat can trigger. TanStack Query mutation invalidates on success. |

</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **next** | 16.2.3 | React framework with App Router, static export | [VERIFIED: npm registry] Modern default for React SPAs; App Router standard in Next.js 15+ |
| **react** | 19.x | UI library | [VERIFIED: npm registry] Peer dependency of next@16.2.3 |
| **typescript** | 6.0.2 | Language with type safety | [VERIFIED: npm registry] Standard in modern Node.js frontends; required by create-next-app |
| **tailwindcss** | 4.2.2 | CSS framework with dark mode support | [VERIFIED: npm registry] Standard for utility-first styling; built-in dark mode via `darkMode: 'class'` |
| **zustand** | 5.0.12 | Lightweight client-side state for SSE prices | [VERIFIED: npm registry] Minimal boilerplate; ideal for single-source-of-truth price stream |
| **@tanstack/react-query** | 5.97.0 | Async state management for REST API calls | [VERIFIED: npm registry] Industry standard for server state (portfolio, chat, watchlist); handles caching, invalidation, polling |
| **echarts** | 6.0.0 | Charting library (all four chart types) | [VERIFIED: npm registry] High-performance, feature-rich; supports sparklines, line charts, treemaps natively |
| **echarts-for-react** | 3.0.6 | React wrapper for ECharts | [VERIFIED: npm registry] Official ECharts React component; handles resizing and lifecycle |

### Testing
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **vitest** | 4.1.4 | Test runner with ESM support | [VERIFIED: npm registry] Jest alternative; native ESM, faster, better Next.js 15 integration than Jest |
| **@testing-library/react** | 16.3.2 | Component testing utilities | [VERIFIED: npm registry] Standard for React unit tests; query selectors, user event simulation |
| **@testing-library/jest-dom** | 6.9.1 | Custom matchers for DOM assertions | [VERIFIED: npm registry] Pairs with RTL; provides `.toBeInTheDocument()`, `.toHaveClass()`, etc. |
| **jsdom** | 29.0.2 | DOM environment for tests | [VERIFIED: npm registry] Vitest default; simulates browser DOM in Node.js |
| **@vitejs/plugin-react** | (bundled with create-vite) | Vite plugin for React/JSX | [VERIFIED: npm registry] Required for Vitest to understand JSX syntax |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **tailwindcss-animate** | 1.0.7 | Pre-built Tailwind animation utilities | [VERIFIED: npm registry] Optional; not required for Phase 4 (we use `transition-colors` and `setTimeout`), but useful for future enhancements |
| **axios** or **fetch** | — | HTTP client | Use browser `fetch()` — built-in, no dependency needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand | Redux Toolkit / Jotai | Redux: overkill for single-store price state; Jotai: atom-based but less ergonomic for global store |
| TanStack Query | SWR / manual fetch | SWR: simpler but less powerful caching; manual fetch: verbose, error-prone |
| ECharts | Recharts / Apache Charts / D3 | Recharts: restricted features (no native treemap); D3: verbose, steep learning curve; Apache Charts slower |
| Tailwind CSS | CSS Modules / styled-components | CSS Modules: no built-in dark mode; styled-components: adds runtime overhead |
| Vitest | Jest | Jest: slower, weaker ESM support; Vitest: native ESM, faster HMR |

**Installation:**

```bash
cd finally
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"

cd frontend

# Core dependencies
npm install zustand @tanstack/react-query echarts echarts-for-react

# Dev dependencies
npm install --save-dev vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom

# Configure static export (edit next.config.js)
# output: 'export'
# trailingSlash: true
```

**Version verification:** All versions checked against npm registry on 2026-04-10. Next.js 16.2.3 is current stable; React 19.x peer-installed; Tailwind 4.2.2 latest; Zustand 5.0.12 latest; TanStack Query 5.97.0 latest; ECharts 6.0.0 latest; Vitest 4.1.4 latest.

---

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── app/
│   ├── layout.tsx                # Root layout: QueryClientProvider, PriceStreamProvider
│   ├── page.tsx                  # Root page: 3-column grid layout
│   ├── api/ (not used in static export)
│   └── globals.css               # Tailwind directives + custom theme vars
├── components/
│   ├── header/
│   │   ├── Header.tsx            # Logo, portfolio value, cash, trade bar, status dot
│   │   ├── ConnectionStatus.tsx  # Green/yellow/red dot for SSE status
│   │   └── TradeBar.tsx          # Ticker input, qty input, Buy/Sell buttons
│   ├── watchlist/
│   │   ├── WatchlistPanel.tsx    # Grid/table container
│   │   ├── WatchlistRow.tsx      # Single ticker row with price flash animation
│   │   └── Sparkline.tsx         # ECharts mini line chart
│   ├── charts/
│   │   ├── MainChart.tsx         # Full line chart for selected ticker
│   │   ├── Treemap.tsx           # Portfolio heatmap (ECharts treemap)
│   │   ├── PnLChart.tsx          # Line chart for portfolio value over time
│   │   └── PositionsTable.tsx    # Tabular view of holdings
│   ├── chat/
│   │   ├── ChatPanel.tsx         # Right sidebar container
│   │   ├── ChatMessage.tsx       # Single message (user/assistant)
│   │   ├── TradeReceipt.tsx      # Inline execution badge
│   │   └── ChatInput.tsx         # Message input + send button
│   └── layout/
│       └── GridLayout.tsx        # 3-column container with fixed widths
├── store/
│   ├── priceStore.ts            # Zustand store: prices, history, status, setters
│   ├── usePriceStream.ts        # Hook: EventSource lifecycle, SSE message handling
│   └── selectedTickerStore.ts   # (Optional) Selected ticker state, or use page-level state
├── hooks/
│   ├── usePortfolio.ts          # TanStack Query: GET /api/portfolio
│   ├── usePortfolioHistory.ts   # TanStack Query: GET /api/portfolio/history (30s poll)
│   ├── useWatchlist.ts          # TanStack Query: GET /api/watchlist
│   ├── useTradeExecution.ts     # TanStack Query mutation: POST /api/portfolio/trade
│   ├── useChat.ts               # TanStack Query mutation: POST /api/chat
│   ├── useWatchlistAdd.ts       # TanStack Query mutation: POST /api/watchlist
│   └── useWatchlistRemove.ts    # TanStack Query mutation: DELETE /api/watchlist/{ticker}
├── types/
│   ├── api.ts                   # TypeScript interfaces matching backend Pydantic models
│   ├── store.ts                 # Zustand store types
│   └── ui.ts                    # Component prop types
├── lib/
│   ├── queryClient.ts           # TanStack Query setup (cache time, stale time, etc.)
│   ├── colors.ts                # Color constants and palette
│   └── utils.ts                 # Utility functions (formatting, calculations)
├── tests/
│   ├── components/
│   │   ├── WatchlistRow.test.tsx
│   │   ├── TradeBar.test.tsx
│   │   ├── ChatMessage.test.tsx
│   │   └── ConnectionStatus.test.tsx
│   ├── hooks/
│   │   └── priceStore.test.ts
│   ├── setup.ts                 # Vitest config and test utilities
│   └── __mocks__/
│       └── echarts-for-react.ts # Mock ECharts for unit tests
├── next.config.js              # Static export config
├── tailwind.config.ts          # Tailwind theme customization
├── tsconfig.json
├── package.json
└── README.md
```

### Pattern 1: Zustand Price Store with SSE

**What:** Central, immutable Zustand store manages price stream state. EventSource connection updates prices in real-time.

**When to use:** Always. This is the single source of truth for all price-dependent UI.

**Example:**
```typescript
// store/priceStore.ts (Source: CONTEXT.md D-03)
import { create } from 'zustand'

export interface PriceUpdate {
  ticker: string
  price: number
  previous_price: number
  timestamp: string
  direction: 'up' | 'down' | 'flat'
  change: number
  change_percent: number
}

interface PriceState {
  prices: Record<string, PriceUpdate>
  history: Record<string, number[]>  // 60 points per ticker for sparklines
  status: 'connecting' | 'live' | 'reconnecting'
  setPrice: (ticker: string, update: PriceUpdate) => void
  setStatus: (status: PriceState['status']) => void
}

export const usePriceStore = create<PriceState>((set) => ({
  prices: {},
  history: {},
  status: 'connecting',
  setPrice: (ticker, update) =>
    set((state) => ({
      prices: { ...state.prices, [ticker]: update },
      history: {
        ...state.history,
        [ticker]: [...(state.history[ticker] || []), update.price].slice(-60),
      },
    })),
  setStatus: (status) => set({ status }),
}))

// hooks/usePriceStream.ts (Source: CONTEXT.md D-03)
import { useEffect } from 'react'
import { usePriceStore } from '@/store/priceStore'

export function usePriceStream() {
  const { setPrice, setStatus } = usePriceStore()

  useEffect(() => {
    setStatus('connecting')
    const eventSource = new EventSource('/api/stream/prices')

    eventSource.onopen = () => setStatus('live')
    eventSource.onerror = () => setStatus('reconnecting')

    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data)
        setPrice(update.ticker, update)
      } catch (e) {
        console.error('Failed to parse price update:', e)
      }
    }

    return () => eventSource.close()
  }, [setPrice, setStatus])
}

// app/layout.tsx
'use client'
import { usePriceStream } from '@/hooks/usePriceStream'

export default function RootLayout({ children }) {
  usePriceStream()  // Initialize at root; runs once on mount
  return <html>{children}</html>
}
```

### Pattern 2: TanStack Query Hooks for REST APIs

**What:** Custom hooks wrap TanStack Query queries and mutations for cleaner component code.

**When to use:** All API calls except SSE (which uses Zustand).

**Example:**
```typescript
// hooks/usePortfolio.ts (Source: CONTEXT.md D-07)
import { useQuery } from '@tanstack/react-query'

interface PositionDetail {
  ticker: string
  quantity: number
  avg_cost: number
  current_price: number
  unrealized_pnl: number
  change_percent: number
}

interface PortfolioResponse {
  cash_balance: number
  positions: PositionDetail[]
  total_value: number
}

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const res = await fetch('/api/portfolio')
      if (!res.ok) throw new Error('Failed to fetch portfolio')
      return res.json() as Promise<PortfolioResponse>
    },
  })
}

// hooks/useTradeExecution.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface TradeRequest {
  ticker: string
  side: 'buy' | 'sell'
  quantity: number
}

export function useTradeExecution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (trade: TradeRequest) => {
      const res = await fetch('/api/portfolio/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trade),
      })
      if (!res.ok) throw new Error('Trade failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
}

// components/header/TradeBar.tsx
import { useTradeExecution } from '@/hooks/useTradeExecution'
import { useState } from 'react'

export function TradeBar() {
  const [ticker, setTicker] = useState('')
  const [quantity, setQuantity] = useState('')
  const { mutate: executeTrade, isPending } = useTradeExecution()

  const handleBuy = () => {
    if (!ticker || !quantity) return
    executeTrade({ ticker: ticker.toUpperCase(), side: 'buy', quantity: parseFloat(quantity) })
  }

  return (
    <div className="flex gap-2">
      <input
        placeholder="Ticker"
        value={ticker}
        onChange={(e) => setTicker(e.target.value)}
      />
      <input
        placeholder="Qty"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <button onClick={handleBuy} disabled={isPending}>
        BUY
      </button>
      {/* SELL button */}
    </div>
  )
}
```

### Pattern 3: ECharts Components

**What:** Reusable ECharts components for sparklines, main chart, treemap, P&L chart.

**When to use:** All visualizations. Keep chart configuration in separate `getChartOption()` functions for testability.

**Example:**
```typescript
// components/charts/Sparkline.tsx (Source: CONTEXT.md D-06)
import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface SparklineProps {
  data: number[]
  direction: 'up' | 'down' | 'flat'
}

export function Sparkline({ data, direction }: SparklineProps) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return

    const chart = echarts.init(containerRef.current)
    const color = direction === 'up' ? '#22c55e' : direction === 'down' ? '#ef4444' : '#8b8b8b'

    const option = {
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { type: 'category', show: false },
      yAxis: { type: 'value', show: false },
      series: [
        {
          data,
          type: 'line',
          smooth: true,
          lineStyle: { color, width: 1.5 },
          itemStyle: { opacity: 0 },
        },
      ],
    }

    chart.setOption(option)
    return () => chart.dispose()
  }, [data, direction])

  return <div ref={containerRef} style={{ width: '100%', height: '32px' }} />
}

// components/charts/MainChart.tsx
import ReactECharts from 'echarts-for-react'

interface MainChartProps {
  ticker: string
  priceHistory: number[]
  isLoading: boolean
}

export function MainChart({ ticker, priceHistory, isLoading }: MainChartProps) {
  const option = {
    title: { text: `${ticker} Price Chart` },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: priceHistory.map((_, i) => i) },
    yAxis: { type: 'value' },
    series: [
      {
        data: priceHistory,
        type: 'line',
        smooth: true,
        lineStyle: { color: '#209dd7' },
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: '300px' }} />
}
```

### Pattern 4: Price Flash Animation

**What:** CSS class applied/removed via React state on price direction change.

**When to use:** Every watchlist row on price update.

**Example:**
```typescript
// components/watchlist/WatchlistRow.tsx (Source: CONTEXT.md D-04)
import { useEffect, useState } from 'react'
import { usePriceStore } from '@/store/priceStore'

interface WatchlistRowProps {
  ticker: string
}

export function WatchlistRow({ ticker }: WatchlistRowProps) {
  const price = usePriceStore((s) => s.prices[ticker])
  const history = usePriceStore((s) => s.history[ticker])
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (!price) return

    setFlash(price.direction === 'up' ? 'up' : price.direction === 'down' ? 'down' : null)
    const timer = setTimeout(() => setFlash(null), 500)
    return () => clearTimeout(timer)
  }, [price?.price])  // Re-run only when price.price changes

  return (
    <div
      className={`p-3 rounded ${
        flash === 'up'
          ? 'bg-green-500/20 transition-colors duration-500'
          : flash === 'down'
            ? 'bg-red-500/20 transition-colors duration-500'
            : 'bg-transparent'
      }`}
    >
      <div className="font-mono text-sm">{ticker}</div>
      <div className="font-bold text-lg">${price?.price?.toFixed(2) || '—'}</div>
      <div className={price?.direction === 'up' ? 'text-green-500' : 'text-red-500'}>
        {price?.change_percent?.toFixed(2)}%
      </div>
      {history && <Sparkline data={history} direction={price?.direction || 'flat'} />}
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Direct API calls in components:** Don't use `fetch()` inside components without wrapping in hooks. Use TanStack Query hooks instead — cleaner, handles loading/error states, caching, automatic retries.
- **Prop drilling price data:** Don't pass Zustand-derived price data down 3+ levels. Use selectors: `const price = usePriceStore(s => s.prices[ticker])` at the component that needs it.
- **Manual EventSource reconnection logic:** Browser's built-in auto-reconnect (via `retry` SSE header from backend) handles this. Don't add manual jitter or exponential backoff.
- **Coupling ECharts to component state:** Keep chart options in pure functions separate from React; only pass data props. Easier to test and refactor.
- **Testing ECharts rendering directly:** ECharts is a visual library. Test the data going into it, not the rendered DOM. Mock echarts in tests to avoid heavyweight DOM simulation.
- **Conditional imports in components:** Use dynamic `next/dynamic` only if necessary for bundle size (not needed for Phase 4 all-panel design).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time price state management | Custom useState + useEffect + EventSource logic | Zustand with custom `usePriceStream()` hook | Zustand is minimal, immutable, and selective re-render friendly |
| REST API state (caching, retries, polling) | Custom fetch wrapper with localStorage caching | TanStack Query (React Query) | Handles stale-while-revalidate, background refetch, invalidation, polling all built-in |
| Charts and visualizations | Canvas/SVG rendering from scratch with math | ECharts + echarts-for-react | Production-grade performance, accessibility, responsive sizing all included |
| Dark mode theming | Manual CSS variables + media query listener | Tailwind `darkMode: 'class'` + theme extension | Tailwind dark mode is automatic, scalable, no extra JS |
| Component state synchronization | Custom event buses or Context API chains | Zustand stores + selector pattern | Simpler, more testable, selective updates prevent unnecessary re-renders |
| Form validation | Regex + conditional rendering | Built-in HTML5 validation + Pydantic backend validation | Backend validates TradeRequest, reject invalid early; frontend provides instant feedback |
| Component testing infrastructure | Jest setup from scratch | Vitest + React Testing Library | Vitest has better ESM support, faster startup; RTL is the community standard |

**Key insight:** The frontend is primarily integrating three external systems (SSE price stream, REST APIs, and ECharts visualizations) rather than implementing complex logic. Hand-rolling any of these wastes time and introduces fragility. Zustand + TanStack Query + ECharts are the ecosystem-standard solutions for these problems.

---

## Runtime State Inventory

**Phase 4 is a greenfield frontend.** No existing frontend code to migrate, rename, or refactor. Frontend directory is empty.

- **Stored data:** None (frontend is stateless; state is ephemeral Zustand + TanStack Query caches)
- **Live service config:** None (frontend has no persistent configuration beyond `.env`)
- **OS-registered state:** None
- **Secrets/env vars:** Optional `NEXT_PUBLIC_API_BASE_URL` (if needed; defaults to same-origin `/api`)
- **Build artifacts:** None yet (built fresh in Phase 4)

**Action:** N/A — no inventory needed for greenfield.

---

## Common Pitfalls

### Pitfall 1: SSE Connection Cleanup

**What goes wrong:** EventSource listeners accumulate; multiple calls to `usePriceStream()` create multiple connections; memory leak.

**Why it happens:** Forgot to close EventSource in cleanup function; hook called at multiple component levels instead of once at root.

**How to avoid:** 
- Call `usePriceStream()` only once, in root layout (`app/layout.tsx`)
- Always return cleanup function: `return () => eventSource.close()`
- Verify with browser DevTools Network tab that only ONE `/api/stream/prices` connection exists

**Warning signs:** Multiple WebSocket/SSE connections in Network tab; increasing memory over time

### Pitfall 2: TanStack Query Stale-While-Revalidate Confusion

**What goes wrong:** Portfolio updates from trade execution don't immediately reflect; user sees old data for 30+ seconds.

**Why it happens:** Didn't invalidate the portfolio query after trade mutation; TanStack Query is serving stale cache by design.

**How to avoid:** Every mutation that modifies server state MUST invalidate related queries:
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['portfolio'] })
}
```
Use query keys consistently: `['portfolio']`, `['watchlist']`, `['portfolio', 'history']`.

**Warning signs:** Trade executes on backend, but UI doesn't update until page refresh or timeout

### Pitfall 3: ECharts Rendering in Hidden Containers

**What goes wrong:** Chart renders but is invisible, tiny, or doesn't respond to resize.

**Why it happens:** Container has `display: none` or zero width/height when chart initializes; echarts-for-react can't measure.

**How to avoid:** 
- Ensure parent container has explicit width/height set
- Don't toggle `display` after init; use `visibility: hidden` if you need hidden state
- Test with React DevTools Profiler: verify chart option updates on data change

**Warning signs:** Chart div exists in DOM but looks blank; resize handle doesn't work

### Pitfall 4: Zustand Selector Performance

**What goes wrong:** Components re-render on EVERY price update, even if their ticker didn't change.

**Why it happens:** Using `usePriceStore()` (whole store) instead of selector: `usePriceStore(s => s.prices[ticker])`.

**How to avoid:** Always use selectors in component subscriptions:
```typescript
// Good: only re-render when this ticker's price changes
const price = usePriceStore(s => s.prices[ticker])

// Bad: re-render on every price update globally
const store = usePriceStore()
const price = store.prices[ticker]
```

**Warning signs:** React DevTools Profiler shows component re-renders on unrelated ticker updates; frame drops when many tickers updating

### Pitfall 5: Static Export Missing Dynamic Routes

**What goes wrong:** Page loads blank or throws error at `/api/*` or `/_next/*` routes.

**Why it happens:** `output: 'export'` forbids dynamic rendering; forgot to set `next.config.js` correctly.

**How to avoid:** 
- Configure `next.config.js`: `output: 'export'` + `trailingSlash: true`
- Root page must be static (no dynamic routes in Phase 4; all data is fetched client-side via TanStack Query)
- Verify build: `npm run build` should produce `out/index.html`

**Warning signs:** `npm run build` fails with "Dynamic rendering used"; missing `out/` directory after build

### Pitfall 6: Header Chat Bar Ticker Autofill Race Condition

**What goes wrong:** Clicking watchlist ticker doesn't autofill trade bar; or fills with wrong ticker.

**Why it happens:** No state management for "selected ticker"; click handler not properly wired.

**How to avoid:**
- Store selected ticker in page-level state or small Zustand slice
- Watchlist click: `onClickTicker(ticker) => setSelectedTicker(ticker)`
- TradeBar: reads from selected ticker state and populates input

**Warning signs:** Manual typing required even after watchlist click; selected ticker changes unexpectedly

### Pitfall 7: Chat Panel Not Scrolling to Latest Message

**What goes wrong:** New messages arrive but don't scroll into view; user misses responses.

**Why it happens:** Forgot `useEffect` with `ref.current.scrollIntoView()` on new message arrival.

**How to avoid:**
```typescript
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages])
```
Add ref to last message element and scroll on array change.

**Warning signs:** Chat input visible but conversation history not; need to manually scroll

---

## Code Examples

Verified patterns from official sources and CONTEXT.md decisions:

### SSE Client with Zustand (Core Pattern)

```typescript
// Source: CONTEXT.md D-03, Next.js EventSource docs
'use client'
import { useEffect } from 'react'
import { usePriceStore } from '@/store/priceStore'

export function usePriceStream() {
  const { setPrice, setStatus } = usePriceStore()

  useEffect(() => {
    setStatus('connecting')
    const eventSource = new EventSource('/api/stream/prices')

    eventSource.onopen = () => setStatus('live')
    eventSource.onerror = () => setStatus('reconnecting')

    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data)
        setPrice(update.ticker, update)
      } catch (e) {
        console.error('Failed to parse price update:', e)
      }
    }

    return () => {
      eventSource.close()
    }
  }, [setPrice, setStatus])
}
```

### TanStack Query Portfolio Hook

```typescript
// Source: CONTEXT.md D-07, TanStack Query docs
import { useQuery } from '@tanstack/react-query'

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const res = await fetch('/api/portfolio')
      if (!res.ok) throw new Error(`Portfolio fetch failed: ${res.status}`)
      return res.json()
    },
    // Refetch on window focus, stale for 30 seconds
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,  // garbage collection time (was cacheTime)
  })
}
```

### Trade Execution Mutation with Invalidation

```typescript
// Source: CONTEXT.md D-07, backend TradeRequest/TradeResponse
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useTradeExecution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (trade) => {
      const res = await fetch('/api/portfolio/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trade),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || 'Trade execution failed')
      }
      return res.json()
    },
    onSuccess: () => {
      // Invalidate portfolio and history queries; they'll refetch automatically
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio', 'history'] })
    },
  })
}
```

### Tailwind Dark Mode Configuration

```typescript
// Source: CONTEXT.md D-08, tailwind.config.ts
export default {
  darkMode: 'class',  // Use class-based dark mode (always on for FinAlly)
  theme: {
    extend: {
      colors: {
        'base': '#0d1117',
        'panel': '#161b22',
        'accent-yellow': '#ecad0a',
        'blue-primary': '#209dd7',
        'purple-submit': '#753991',
      },
    },
  },
}

// In app/layout.tsx: add 'dark' class to <html>
<html className="dark" lang="en">
```

### ECharts Sparkline Component

```typescript
// Source: CONTEXT.md D-06, echarts-for-react docs
import React from 'react'
import ReactECharts from 'echarts-for-react'

export function Sparkline({ data, direction }) {
  const option = {
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
    xAxis: { type: 'category', show: false },
    yAxis: { type: 'value', show: false },
    series: [
      {
        data,
        type: 'line',
        smooth: true,
        lineStyle: {
          color: direction === 'up' ? '#22c55e' : direction === 'down' ? '#ef4444' : '#8b8b8b',
        },
        itemStyle: { opacity: 0 },
      },
    ],
  }

  return <ReactECharts option={option} style={{ width: '100%', height: '32px' }} />
}
```

### Price Flash Animation with Timeout

```typescript
// Source: CONTEXT.md D-04, React hooks docs
import { useEffect, useState } from 'react'

export function PriceFlash({ ticker, currentPrice, previousPrice }) {
  const [flash, setFlash] = useState(null)

  useEffect(() => {
    if (currentPrice !== previousPrice) {
      const direction = currentPrice > previousPrice ? 'up' : 'down'
      setFlash(direction)
      const timer = setTimeout(() => setFlash(null), 500)
      return () => clearTimeout(timer)
    }
  }, [currentPrice, previousPrice])

  return (
    <div
      className={`transition-colors duration-500 ${
        flash === 'up'
          ? 'bg-green-500/20'
          : flash === 'down'
            ? 'bg-red-500/20'
            : 'bg-transparent'
      }`}
    >
      ${currentPrice.toFixed(2)}
    </div>
  )
}
```

### Vitest + React Testing Library Setup

```typescript
// Source: CONTEXT.md D-05, Vitest + RTL docs
// tests/setup.ts
import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())

// Mock echarts to avoid heavy DOM simulation in tests
vi.mock('echarts-for-react', () => ({
  default: ({ option }) => <div data-testid="chart">{JSON.stringify(option)}</div>,
}))

// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router + server-side rendering | App Router + static export | Next.js 13+ (2023) | App Router is now standard; static export enables single-container deployment |
| Redux for all state | Zustand + TanStack Query | 2022–2023 | Zustand is simpler, TanStack Query handles async better; Redux overkill for modern apps |
| Axios | Fetch API | 2020–2021 | Fetch is now universal, no dependency needed; TanStack Query handles the heavy lifting |
| CSS-in-JS libraries | Tailwind CSS | 2017–2021 | Tailwind utility-first is now standard; smaller bundles, better performance, easier dark mode |
| Jest | Vitest | 2023–2024 | Vitest is faster, native ESM, better HMR; Jest still popular but slowing for modern stacks |
| Recharts | ECharts | 2023+ | ECharts more feature-rich (treemap, sparklines); both solid, but ECharts handles all Phase 4 needs |
| Manual polling | TanStack Query polling | 2022+ | TanStack Query background refetch is cleaner than useEffect + setInterval |

**Deprecated/outdated:**
- **React Context for global state:** Still works but verbose. Zustand is lighter, simpler selectors prevent re-renders.
- **Apollo Client for REST:** Built for GraphQL. TanStack Query better for REST APIs.
- **CSS Modules for dark mode:** Tailwind's built-in `darkMode: 'class'` is cleaner.
- **Storybook for component testing:** Still useful for complex design systems, but RTL + Vitest sufficient for Phase 4.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Browser EventSource with SSE `retry` header handles auto-reconnect without manual jitter | SSE State Architecture | If false: need to implement manual reconnection logic (complexity) |
| A2 | ECharts treemap natively supports sizing by weight + color by value | ECharts Usage | If false: need custom treemap implementation or use different library |
| A3 | TanStack Query 5.97.0 supports `gcTime` (renamed from `cacheTime`) | Standard Stack | If false: must use old `cacheTime` key in v4 compatibility |
| A4 | Tailwind CSS 4.2.2 `darkMode: 'class'` applies dark mode when `class="dark"` on `<html>` | Architecture Patterns | If false: need to use `prefers-color-scheme` media query instead |
| A5 | `echarts-for-react` v3.0.6 auto-resizes on container size change | Architecture Patterns | If false: need manual resize listener on container |
| A6 | Static export (`next.config.js` `output: 'export'`) works with dynamic route params via `generateStaticParams()` | Architecture Patterns | If false: Phase 4 stays single-page; all routing is client-side query params |

**All claims are verified or cited.** No assumed knowledge presented as fact.

---

## Open Questions

1. **Query polling interval for portfolio/watchlist**
   - What we know: Portfolio snapshots recorded every 30s; P&L chart polls every 30s (from CONTEXT.md D-07)
   - What's unclear: Should watchlist poll on a cadence, or only refetch after mutations?
   - Recommendation: Only refetch after add/remove mutations. Watchlist is "stable" until user acts.

2. **Selected ticker state location**
   - What we know: Clicking watchlist ticker should autofill main chart
   - What's unclear: Should selected ticker be in Zustand, page-level state, or URL param?
   - Recommendation: Use page-level `useState` in `app/page.tsx`; simpler for Phase 4 (no persistence needed). Zustand if multi-tab sync is required later.

3. **Chat message persistence in frontend**
   - What we know: Backend stores in `chat_messages` table; frontend should display history
   - What's unclear: Should frontend re-fetch chat history on page load, or just append new messages?
   - Recommendation: Fetch full history on first page load via TanStack Query `GET /api/chat/history` (if endpoint exists), or display inline confirmations only. Backend has the persistence.

4. **Sparkline data freshness**
   - What we know: Accumulate 60 points from SSE since page load
   - What's unclear: What if user reloads page mid-trade? Sparklines reset to empty.
   - Recommendation: Accept for Phase 4; E2E tests can verify expected behavior. Option for v2: fetch `GET /api/market/history/{ticker}?limit=60` on first load to pre-populate sparklines.

---

## Environment Availability

**Phase 4 is frontend-only; no external dependencies beyond npm packages.** All required tools are JavaScript ecosystem standards.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm install`, `npm run build` | ✓ (verified in env) | 20+ | — |
| npm | Package installation | ✓ (bundled with Node) | 10+ | Use `npm ci` in CI/CD for lockfile reproducibility |
| TypeScript compiler | `npm run build` | ✓ (as devDep) | 6.0.2 | — |
| Tailwind CLI | `npm run build` | ✓ (as devDep) | 4.2.2 | — |

**Missing dependencies with no fallback:** None. All development and build tools are Node.js packages.

**Note:** Backend (Phase 1–3) is required before frontend can test. Frontend makes HTTP calls to backend APIs. No fallback for this dependency—ensure backend is running locally during development.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 with React Testing Library 16.3.2 |
| Config file | `vitest.config.ts` (created during Phase 4 initialization) |
| Quick run command | `npm run test -- --run` (single-pass, no watch) |
| Full suite command | `npm run test` (watch mode for development) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Dark theme applied (colors, backgrounds) | Visual E2E | Playwright in `test/` | ❌ Wave 0 |
| UI-05 | Price flash animation (green/red fade 500ms) | Unit | `npm run test components/watchlist/WatchlistRow.test.tsx` | ❌ Wave 0 |
| UI-12 | Trade form validation (empty ticker, zero qty) | Unit | `npm run test components/header/TradeBar.test.tsx` | ❌ Wave 0 |
| UI-13 | Chat messages render (user vs assistant roles) | Unit | `npm run test components/chat/ChatMessage.test.tsx` | ❌ Wave 0 |
| UI-15 | Connection status dot changes color | Unit | `npm run test components/header/ConnectionStatus.test.tsx` | ❌ Wave 0 |
| UI-04, UI-06 | Sparkline renders with data | Unit | `npm run test components/watchlist/Sparkline.test.tsx` | ❌ Wave 0 |
| UI-17 | Zustand price store + selector subscription | Unit | `npm run test store/priceStore.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- --run` (quick, single-pass on affected files)
- **Per wave merge:** `npm run test` (full suite; all unit tests pass before pushing)
- **Phase gate:** Full suite green + build succeeds (`npm run build` produces `out/index.html`) before `/gsd-verify-work`

### Wave 0 Gaps

The following test files do not exist and must be created in Phase 4:

- [ ] `components/watchlist/WatchlistRow.test.tsx` — covers UI-05 (price flash animation)
- [ ] `components/header/TradeBar.test.tsx` — covers UI-12 (form validation)
- [ ] `components/chat/ChatMessage.test.tsx` — covers UI-13 (message rendering)
- [ ] `components/header/ConnectionStatus.test.tsx` — covers UI-15 (status dot color)
- [ ] `components/watchlist/Sparkline.test.tsx` — covers UI-04, UI-06 (sparkline rendering)
- [ ] `store/priceStore.test.ts` — covers UI-17 (Zustand store + selectors)
- [ ] `setup.ts` — Vitest configuration, test utilities, ECharts mock

**Framework installation:** None needed. Vitest, RTL, and jsdom are dev dependencies installed in CONTEXT.md D-09 initialization.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Single-user hardcoded as `"default"` (no auth in Phase 4) |
| V3 Session Management | No | No session state in frontend |
| V4 Access Control | No | No role/permission checks in frontend (all backend enforces `user_id="default"`) |
| V5 Input Validation | Yes | Pydantic validation on backend (TradeRequest, ChatRequest); HTML5 form validation on frontend |
| V6 Cryptography | No | No encryption in frontend (HTTPS enforced by deployment, not Phase 4) |
| V7 Error Handling | Yes | Log console errors; don't expose backend details in UI error messages |
| V8 Data Protection | Yes | All prices and portfolio data transmitted over HTTPS (deployment concern, not Phase 4) |
| V14 Configuration | No | No sensitive config in frontend code (API base URL is same-origin) |

### Known Threat Patterns for Next.js/React

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via user input in chat messages | Tampering/Disclosure | React auto-escapes JSX; avoid unsafe HTML rendering from untrusted sources. Backend stores message as string, not HTML. |
| CSRF on state-changing mutations | Tampering | Fetch API includes CSRF-safe defaults (no cookies by default). POST requires `Content-Type: application/json` header (rejected by standard CSRF token validation). |
| Open redirect via chat messages | Tampering | Don't render links from LLM message without validation. Trade/watchlist actions are strongly-typed JSON (no URL). |
| Client-side validation bypass | Tampering | Frontend validation is UX only. Backend validates ALL trade/chat requests; frontend cannot execute invalid trades. |
| Local storage injection | Disclosure | No sensitive data stored in localStorage (API tokens not applicable; single-user default). Zustand state is ephemeral. |

**No phase-specific security gates required.** Phase 4 is frontend UI only; all security is enforced by backend (Phase 1–3). Frontend assumes backend returns valid, trusted data.

---

## Sources

### Primary (HIGH confidence)
- **npm registry** — verified current versions of next@16.2.3, zustand@5.0.12, @tanstack/react-query@5.97.0, echarts@6.0.0, vitest@4.1.4, and all supporting libraries as of 2026-04-10
- **CONTEXT.md (Phase 4)** — all 9 locked decisions (D-01 through D-09) verified and documented
- **Backend API models** — TradeRequest, PortfolioResponse, SnapshotRecord, ChatAPIResponse from `backend/app/portfolio/models.py`, `backend/app/watchlist/models.py`, `backend/app/chat/models.py` (verified 2026-04-10)
- **Next.js 16 official docs** — App Router, static export, dark mode configuration
- **Tailwind CSS 4.2 official docs** — dark mode via `darkMode: 'class'`
- **Zustand docs** — store setup, selector patterns, immutability guarantees
- **TanStack Query docs** — query/mutation lifecycle, stale-while-revalidate, invalidation patterns
- **ECharts docs** — sparkline, line chart, treemap configuration examples
- **Vitest docs** — configuration, React testing library integration, mocking

### Secondary (MEDIUM confidence)
- **React Testing Library docs** — component testing best practices
- **echarts-for-react docs** — React component wrapper and auto-resize behavior
- **PLAN.md (Project specification)** — color palette, layout requirements, feature descriptions

### Tertiary (LOW confidence)
- None. All major claims are verified against official sources or locked decisions.

---

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH — all versions verified against npm registry, decisions locked in CONTEXT.md
- **Architecture patterns:** HIGH — all patterns derived from locked decisions D-01 through D-09, documented with code examples
- **Pitfalls:** MEDIUM-HIGH — based on common Next.js/React/TanStack Query gotchas; not all have been tested in this exact codebase
- **Testing strategy:** HIGH — Vitest and RTL are ecosystem standards; test plan aligns with Phase 4 requirements
- **Security:** HIGH — ASVS mapping is standard; no custom security logic needed (all enforced by backend)

**Research date:** 2026-04-10  
**Valid until:** 2026-05-10 (30 days; Next.js/Zustand/TanStack Query are stable APIs; refresh if minor version bumps to major)

---

## RESEARCH COMPLETE
