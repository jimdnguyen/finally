# FinAlly — AI Trading Workstation

A visually stunning AI-powered trading workstation that streams live market data, simulates portfolio trading, and integrates an LLM chat assistant that can analyze positions and execute trades via natural language.

Built entirely by coding agents as a capstone project for an agentic AI coding course.

<p align="center">
  <img src="docs/screenshots/demo.gif" width="100%" alt="FinAlly demo" />
</p>

![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![LiteLLM](https://img.shields.io/badge/LiteLLM-purple)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## Features

- **Live price streaming** via SSE with green/red flash animations
- **Simulated portfolio** — $10k virtual cash, market orders, instant fills
- **Portfolio visualizations** — heatmap (treemap), P&L chart, positions table
- **AI chat assistant** — analyzes holdings, suggests and auto-executes trades
- **Watchlist management** — track tickers manually or via AI
- **Dark terminal aesthetic** — Bloomberg-inspired, data-dense layout

## Architecture

Single Docker container serving everything on port 8000:

- **Frontend**: Next.js (static export) with TypeScript and Tailwind CSS
- **Backend**: FastAPI (Python/uv) with SSE streaming
- **Database**: SQLite with lazy initialization (persistent via Docker volume)
- **AI**: LiteLLM → OpenRouter (free tier) with structured outputs
- **Market data**: Built-in GBM simulator (default) or Massive API (optional)

## Quick Start

```bash
# Clone and configure
cp .env.example .env
# Add your OPENROUTER_API_KEY to .env

# Run with Docker Compose
docker compose up --build

# Open http://localhost:8000
```

Or use Make:

```bash
make start   # build and run
make stop    # stop and remove container
make logs    # tail container logs
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for AI chat |
| `MASSIVE_API_KEY` | No | Massive (Polygon.io) key for real market data; omit to use simulator |
| `LLM_MOCK` | No | Set `true` for deterministic mock LLM responses (testing) |

## Testing

**E2E tests** (Playwright, runs in Docker — no browser install needed):

```bash
make test            # default browser
make test-chromium   # Chromium only
make test-firefox    # Firefox only
```

Tests run with `LLM_MOCK=true` so no API key is required.

**Backend unit tests:**

```bash
cd backend
uv run pytest -v
```

CI runs backend tests + ruff linting + a docker build check on every push via GitHub Actions (`.github/workflows/test.yml`).

## Project Structure

```
finally/
├── frontend/               # Next.js (TypeScript) static export
│   └── src/
│       ├── components/     # UI components (watchlist, chart, heatmap, chat)
│       ├── store/          # Zustand state management
│       └── lib/            # API client, SSE hook, utilities
├── backend/                # FastAPI uv project (Python)
│   └── app/
│       ├── chat/           # LLM integration (LiteLLM → OpenRouter)
│       ├── market/         # Price simulator + Massive API + SSE stream
│       ├── portfolio/      # Trade execution, P&L, snapshots
│       └── watchlist/      # Ticker management
├── test/                   # Playwright E2E tests
│   ├── specs/              # Test specs (fresh-start, trading, chat, watchlist)
│   └── docker-compose.test.yml
├── docs/screenshots/       # README screenshots and demo GIF
├── db/                     # SQLite volume mount (runtime, gitignored)
├── Makefile                # start / stop / test shortcuts
├── docker-compose.yml
└── Dockerfile              # Multi-stage: Node 20 build → Python 3.12 serve
```

## Screenshots

<p align="center">
  <img src="docs/screenshots/heatmap.png" width="100%" alt="Portfolio Heatmap" />
  <img src="docs/screenshots/pnl.png" width="100%" alt="P&amp;L History" />
  <img src="docs/screenshots/positions.png" width="100%" alt="Positions Table" />
</p>

## License

See [LICENSE](LICENSE).
