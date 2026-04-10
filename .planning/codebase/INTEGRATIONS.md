# External Integrations

**Last updated:** 2026-04-09
**Focus:** tech

## Summary

FinAlly integrates with three primary external systems: Polygon.io (real market data via Massive library), OpenRouter LLM API (via LiteLLM for chat-based trade execution), and an optional internal SQLite database for portfolio state. Environment variables control all external connections, enabling seamless switching between simulation mode and real data.

---

## APIs & External Services

### Market Data

**Massive API (Polygon.io):**
- What it's used for: Real-time stock price snapshots for the 10 watched tickers
- SDK/Client: `massive` Python library (1.0.0+)
- Endpoint: `GET /v2/snapshot/locale/us/markets/stocks/tickers`
- Authentication: Via `MASSIVE_API_KEY` environment variable
- Conditional: Only active if `MASSIVE_API_KEY` is set and non-empty; otherwise, internal GBM simulator is used
- Rate limits: Free tier 5 req/min → default poll interval 15s; paid tiers support faster polling
- Implementation: `backend/app/market/massive_client.py` — `MassiveDataSource` class polls on interval and updates `PriceCache`
- Timeout: REST client runs in async-to-thread to avoid blocking event loop

### LLM Integration (Planned, Not Yet Implemented)

**OpenRouter via LiteLLM:**
- What it's used for: Chat-based portfolio analysis, trade suggestions, and auto-execution of trades
- Model: `openrouter/openrouter/free` (Cerebras as inference provider via OpenRouter free tier)
- SDK/Client: LiteLLM (structured outputs support)
- Authentication: Via `OPENROUTER_API_KEY` environment variable
- When used: On POST `/api/chat` endpoint (not yet scaffolded in backend)
- Behavior: Sends portfolio context (cash, positions, watchlist, P&L) + conversation history; receives structured JSON with message, trades array, watchlist_changes array
- Auto-execution: Trades parsed from LLM response execute immediately (validated for sufficient cash/shares)
- Note: Memory in `.claude-personal/projects/.../memory/MEMORY.md` documents LiteLLM OpenRouter free model string: use `openrouter/openrouter/free` not `openrouter/free` to avoid 502 errors

---

## Data Storage

### Database

**SQLite:**
- Type: File-based relational database
- Location: `db/finally.db` (volume-mounted in Docker; created at runtime)
- Connection: No explicit ORM yet (schema defined in SQL); lazy initialization on first request
- Schema files: (Planned in `backend/db/schema.sql` and `backend/db/seed.sql`)
- Lazy init: Backend checks for existence and creates tables if missing

**Tables (Per PLAN.md):**
- `users_profile` — Cash balance, created_at; default user `id="default"`
- `watchlist` — User ID, ticker, added_at; unique constraint on (user_id, ticker)
- `positions` — Holdings per ticker: ticker, quantity, avg_cost, updated_at
- `trades` — Trade history: ticker, side, quantity, price, executed_at (append-only log)
- `portfolio_snapshots` — Time-series snapshots (every 30s + post-trade): total_value, recorded_at
- `chat_messages` — Conversation history: role, content, actions (JSON), created_at

**No ORM Currently:**
- Raw SQL execution planned (no SQLAlchemy, no Django ORM)
- Simple async context managers for connections

---

## Authentication & Identity

**Auth Provider:**
- Custom (hardcoded single user)
- User ID: `"default"` (hard-coded in all queries)
- No login/signup flow (demo application)
- All endpoints implicitly use `user_id="default"`

**Future Multi-User:**
- Schema supports future multi-user via `user_id` column (defaulting to `"default"`)
- No authentication layer yet; would be added in future phase

---

## Monitoring & Observability

**Error Tracking:**
- None currently (not configured)
- Planned: Sentry or similar for production

**Logs:**
- Python logging via `logging` module
- Rich console formatting for terminal output
- Levels: INFO (startup/events), DEBUG (per-poll details), ERROR (API failures)
- Output: stdout (structured logging framework not yet added)

**Metrics:**
- None yet (could add Prometheus endpoints for Docker monitoring)

---

## CI/CD & Deployment

### Hosting

**Local Development:**
- Direct Python: `cd backend && uv run uvicorn app.main:app` (main.py not yet written)
- Docker: `docker run -v finally-data:/app/db -p 8000:8000 --env-file .env finally`

**Production:**
- AWS App Runner, Render, or similar (container-based deployment)
- Docker container via CI/CD (GitHub Actions planned but not configured)

### CI Pipeline

**Status:** Not yet configured

**Planned (per PLAN.md):**
- GitHub Actions workflow to:
  - Build Docker image
  - Run pytest suite
  - Push to Docker registry
  - Deploy to App Runner or Render

---

## Environment Configuration

### Required Environment Variables

**For API Keys:**
- `OPENROUTER_API_KEY` (required for LLM chat; no default) — OpenRouter API key for Cerebras model
- `MASSIVE_API_KEY` (optional) — Polygon.io API key; if not set or empty, uses internal GBM simulator

**Optional Toggles:**
- `LLM_MOCK=true|false` (default: false) — When true, LLM returns deterministic mock responses (for E2E tests)

**Database:**
- No explicit env var (SQLite path hardcoded to `db/finally.db`)

**Server:**
- Host/port: Hardcoded to `127.0.0.1:8000` in uvicorn (can be overridden via command-line args)

### Secrets Location

**Development:**
- `.env` file in project root (git-ignored via `.gitignore`)
- `.env.example` committed (template, no secrets)
- Loaded via `python-dotenv` on app startup

**Docker:**
- Passed via `--env-file .env` at container run time
- Mounted as read-only if preferred, or embedded in container at build time

**CI/CD:**
- GitHub Actions secrets: `OPENROUTER_API_KEY`, `MASSIVE_API_KEY` (planned)
- Injected via `secrets:` in workflow or repository settings

---

## Webhooks & Callbacks

**Incoming:**
- None currently planned

**Outgoing:**
- None currently implemented
- Possible future: Webhooks for portfolio value alerts, trade executions to external systems

---

## Third-Party Dependencies with External Integration

| Package | Version | External Service | Purpose |
|---------|---------|-------------------|---------|
| `massive` | 1.0.0+ | Polygon.io API | REST polling for real-time stock prices |
| `litellm` | (planned) | OpenRouter | LLM API gateway and structured output parsing |
| `pydantic` | (implicit) | None | Data validation (local only) |
| `numpy` | 2.0.0+ | None | Math (local only) |

---

## Connection Pooling & Timeouts

**Market Data:**
- Massive REST client: Synchronous (`threading.run_in_executor`), no explicit connection pool (handled by `urllib3` underneath)
- Simulator: In-process, no external calls

**Database:**
- SQLite: Single connection per request (not pooled; file-based I/O is fast enough for single-user)
- No connection pooling configured yet

**LLM:**
- LiteLLM: Default HTTP client timeout (typically 30s)
- No retry logic yet (should add exponential backoff for OpenRouter 429 rate limits)

---

## Rate Limits & Quotas

**Polygon.io (Massive):**
- Free tier: 5 requests/minute → polling interval minimum 12s (using 15s default for safety margin)
- Paid tiers: Custom limits per account
- Backoff: None yet (API errors are logged but polling continues on next interval)

**OpenRouter:**
- Model-specific rate limits (Cerebras via OpenRouter free tier may have daily/monthly quotas)
- No explicit client-side limiting yet
- Requests are synchronous (one message at a time)

---

## Migration & Version Management

**Python Dependencies:**
- Managed via `uv.lock` (reproducible, pinned versions)
- Upgrade: `uv pip install --upgrade [package]` updates and re-locks
- No migration scripts needed yet (SQLite schema is hand-written)

**Database Migrations:**
- Not yet implemented
- Planned: Simple SQL migration runner if schema evolves (alembic not used in single-user model)

**API Versioning:**
- All endpoints are `/api/v1/*` or just `/api/*` (not yet versioned)
- No breaking changes anticipated during development phase

---

*Integration audit: 2026-04-09*
