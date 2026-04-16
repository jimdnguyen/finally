# FinAlly Backend

FastAPI (Python) backend for the FinAlly AI Trading Workstation. Handles market data, portfolio management, AI chat, and serves the static frontend.

## Stack

- **FastAPI** — REST API + SSE streaming
- **aiosqlite** — async SQLite (single file, volume-mounted)
- **LiteLLM → OpenRouter** — LLM integration with structured outputs
- **uv** — dependency management

## Structure

```
app/
├── main.py               # App setup, lifespan, static file serving
├── db.py                 # Database init and connection
├── market/               # Market data subsystem
│   ├── simulator.py      # GBM-based price simulator (default)
│   ├── massive_client.py # Massive/Polygon.io API client (optional)
│   ├── cache.py          # Thread-safe price cache
│   ├── stream.py         # SSE endpoint (/api/stream/prices)
│   └── factory.py        # Selects simulator vs real data by env var
├── portfolio/            # Trade execution, P&L, snapshots
├── watchlist/            # Ticker management
└── chat/                 # LLM chat with auto trade execution
    ├── service.py        # Builds context, calls LLM, executes actions
    └── mock.py           # Deterministic mock for testing (LLM_MOCK=true)
tests/                    # pytest unit + integration tests
```

## Development

```bash
# Install dependencies
uv sync --extra dev

# Run locally (from repo root)
uv run uvicorn app.main:app --reload --port 8000

# Lint
uv run ruff check app/ tests/

# Run tests
uv run pytest -v

# Run tests with coverage
uv run pytest --cov=app --cov-report=term-missing
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for LLM chat |
| `MASSIVE_API_KEY` | No | Polygon.io key for real market data (simulator used if unset) |
| `LLM_MOCK` | No | Set to `true` for deterministic mock LLM responses (used in CI) |
