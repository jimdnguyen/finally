# FinAlly Frontend

Next.js (TypeScript) static export — the UI for the FinAlly AI Trading Workstation. Built as a static site and served by FastAPI on port 8000.

## Stack

- **Next.js 15** — static export (`output: 'export'`)
- **React 19** — UI components
- **TypeScript** — full type coverage
- **Tailwind CSS v4** — dark terminal theme
- **Zustand** — global state (prices, portfolio, watchlist)
- **Lightweight Charts** — candlestick / price charts
- **EventSource** — SSE connection to `/api/stream/prices`

## Structure

```
src/
├── app/                  # Next.js app router (layout, page)
├── components/
│   ├── Header.tsx        # Portfolio value, cash, connection status
│   ├── Watchlist.tsx     # Live price grid with sparklines
│   ├── Chart.tsx         # Main price chart (selected ticker)
│   ├── TradeBar.tsx      # Buy / sell form
│   ├── Heatmap.tsx       # Portfolio treemap (sized by weight, colored by P&L)
│   ├── PnLChart.tsx      # Portfolio value over time
│   ├── Positions.tsx     # Positions table
│   └── ChatPanel.tsx     # AI chat sidebar
├── store/
│   ├── priceStore.ts     # Live prices from SSE
│   └── portfolioStore.ts # Cash, positions, history
└── lib/
    ├── api.ts            # Typed fetch wrappers for all backend endpoints
    └── sse.ts            # SSE hook with auto-reconnect
```

## Development

```bash
npm install
npm run dev       # dev server on http://localhost:3000 (proxies /api to :8000)
npm run build     # static export to frontend/out/
npm run lint      # ESLint
npm run test      # vitest unit tests
```

> The app runs against the FastAPI backend. Start the backend first (`docker compose up` from the repo root) or run it locally with `uv run uvicorn app.main:app --reload` in `backend/`.
