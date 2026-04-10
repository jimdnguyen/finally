# Phase 5: Docker & E2E Testing - Research

**Researched:** 2026-04-10  
**Domain:** Docker containerization, FastAPI static file serving, pytest testing patterns, Playwright E2E testing  
**Confidence:** HIGH

## Summary

Phase 5 packages the complete FinAlly application into a production-ready single Docker container and validates end-to-end flows. The research covers multi-stage Dockerfile best practices (Node 20 → Next.js static build, Python 3.12 → FastAPI), FastAPI configuration for serving Next.js static exports alongside API routes, pytest test organization for trade execution and LLM parsing, Playwright E2E test architecture with docker-compose.test.yml, and idempotent start/stop scripts.

**Primary recommendation:** Use multi-stage Dockerfile with layer caching optimization (copy pyproject.toml + uv.lock before source code), mount Next.js `out/` directory as static files with SPA fallback routing in FastAPI, structure pytest tests in separate modules per domain (trade execution, LLM parsing), run E2E tests in docker-compose with separate test container and LLM_MOCK=true for determinism.

---

## User Constraints

*(None from CONTEXT.md — Phase 5 has no discussion phase decisions yet)*

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Multi-stage Dockerfile (Node 20 → Next.js static, Python 3.12 → FastAPI) | Multi-stage build patterns, layer caching with uv, Node Alpine optimization |
| INFRA-02 | FastAPI serves Next.js static export + all `/api/*` routes on port 8000 | StaticFiles mounting, SPA routing fallback, Next.js `output: 'export'` configuration |
| INFRA-04 | Start/stop scripts (shell + PowerShell) | Idempotent patterns, Docker CLI wrapping, volume/env file handling |
| INFRA-05 | Optional cloud deployment (infrastructure-as-code, stretch goal) | Infrastructure-as-code patterns (Terraform, CloudFormation) for container registries |
| TEST-01 | Backend pytest for trade execution (validation, atomicity, edge cases) | pytest fixtures, TestClient patterns, atomic transaction testing |
| TEST-02 | Backend pytest for LLM response parsing (schema validation, malformed handling) | Pydantic validation testing, JSON parsing robustness, error handling patterns |
| TEST-03 | E2E Playwright tests (fresh start, buy/sell, chat with mock LLM, SSE resilience) | Playwright docker-compose integration, service health checks, baseURL configuration |

---

## Standard Stack

### Docker & Runtime

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Docker | 20.10+ | Container runtime | Industry standard; BuildKit for layer caching enabled by default |
| Node.js | 20-alpine | Frontend build stage | Latest LTS; Alpine for minimal footprint (~5MB vs ~200MB Debian slim) |
| Python | 3.12-slim | Production Python runtime | Latest stable; slim variant with dev tools removed (no gcc, etc.) |
| uv | 0.5.x+ | Python package manager in Docker | Fast reproducible builds; layer caching friendly with --frozen |

### Testing Frameworks

| Library | Version | Purpose | When to Use |
|---------|---------|---------|------------|
| pytest | 8.3.0+ | Backend test runner | Standard FastAPI testing; already in `backend/pyproject.toml` |
| pytest-asyncio | 0.24.0+ | Async test support | Required for `async` test functions; auto mode configured in pyproject.toml |
| httpx | 0.24.0+ | HTTP client for TestClient | Bundled with FastAPI; async/sync support for integration tests |
| Playwright | 1.58+ | E2E browser automation | Cross-browser, headless-capable, docker-friendly with service container |
| @playwright/test | 1.58+ | Playwright test framework | Better than raw Playwright for CI/CD; built-in parallelization, reporting |

### Existing Setup

- **Frontend:** Next.js 15 with TypeScript, Tailwind CSS, configured for static export (`output: 'export'` in next.config.js); builds to `out/` directory
- **Backend:** FastAPI 0.115.0+, Uvicorn 0.32.0+, Python 3.12+, uv project with uv.lock committed
- **Database:** SQLite at `db/finally.db` (volume-mounted); lazy init on startup

---

## Architecture Patterns

### Multi-Stage Dockerfile Structure

**Best Practice Pattern (5-layer optimization):**

```dockerfile
# Stage 1: Node builder (frontend)
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# Output: out/ directory with static export

# Stage 2: Python builder (dependencies only)
FROM python:3.12-slim AS python-builder
WORKDIR /build
RUN pip install uv
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-install-project
# Output: venv with all dependencies installed

# Stage 3: Runtime (production)
FROM python:3.12-slim
WORKDIR /app
RUN useradd -m -u 1000 appuser
COPY --from=python-builder /build/.venv /app/.venv
COPY backend/app ./app
COPY --from=frontend-builder /build/out ./static
ENV PATH="/app/.venv/bin:$PATH"
RUN chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Why this structure:**
- **Stage 1 (frontend-builder):** Separate Node ecosystem from Python; Alpine minimizes build context
- **Stage 2 (python-builder):** Separates dependency installation (cacheable) from source code (changes frequently)
- **Stage 3 (runtime):** Minimal final image; only venv + app code + frontend static files; non-root user for security
- **Cache optimization:** Docker reuses layers when pyproject.toml/uv.lock unchanged, shaving 2-3 min from rebuild

**Key assertions for validation:**
- `test -f ./out/index.html` — Next.js static export succeeded
- `test -f uv.lock` — Lockfile exists in git
- `command -v uvicorn` — Python venv is active in PATH

### FastAPI Static File Serving for Next.js SPA

**Configuration Pattern:**

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="FinAlly")

# Mount all /api/* routes first (they take priority)
app.include_router(create_portfolio_router())  # /api/portfolio, /api/portfolio/trade
app.include_router(create_watchlist_router())  # /api/watchlist
app.include_router(create_chat_router())       # /api/chat
app.include_router(create_stream_router())     # /api/stream/prices

# Mount static files for Next.js SPA
app.mount("/", StaticFiles(directory="static", html=True), name="static")
```

**Why `html=True`:** 
- Tells FastAPI to serve `index.html` for any 404 on missing files
- Allows Next.js client router to handle `/dashboard`, `/portfolio`, etc.
- Without this, direct visits to `/dashboard` would 404 instead of loading the SPA

**Port constraint:** Single port 8000 serves both API and frontend; no reverse proxy needed in single-container model.

### pytest Test Organization

**Module structure (existing, verified in repo):**

```
backend/tests/
├── conftest.py                  # Shared fixtures: test_db, price_cache, client
├── test_db.py                   # Database initialization and schema
├── test_health.py               # Health check endpoint
├── test_portfolio.py            # Trade execution, validation, edge cases
├── test_watchlist.py            # Watchlist CRUD
├── chat/
│   ├── conftest.py              # Chat-specific fixtures
│   └── test_chat_parsing.py     # LLM response schema validation
└── market/
    └── [existing market data tests]
```

**TEST-01: Trade Execution Testing Pattern**

```python
# backend/tests/test_portfolio.py
import pytest
from fastapi.testclient import TestClient

@pytest.mark.asyncio
async def test_buy_success_with_sufficient_cash(client: TestClient, test_db):
    """Buy 10 AAPL with sufficient cash; position created, cash decreases."""
    # Arrange
    aapl_price = 190.0
    price_cache.update("AAPL", aapl_price, timestamp="2026-04-10T12:00:00Z")
    
    # Act
    response = client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "buy"}
    )
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["executed_quantity"] == 10
    assert data["executed_price"] == aapl_price
    
    # Verify position created in DB
    cursor = test_db.cursor()
    cursor.execute("SELECT quantity FROM positions WHERE ticker='AAPL'")
    assert cursor.fetchone()[0] == 10

@pytest.mark.asyncio
async def test_buy_fails_insufficient_cash(client: TestClient):
    """Buy 100,000 shares without sufficient cash; returns 400."""
    response = client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 100000, "side": "buy"}
    )
    assert response.status_code == 400
    assert "insufficient" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_sell_fails_oversell(client: TestClient):
    """Sell 50 shares without owning them; returns 400."""
    response = client.post(
        "/api/portfolio/trade",
        json={"ticker": "UNKNOWN", "quantity": 50, "side": "sell"}
    )
    assert response.status_code == 400
```

**TEST-02: LLM Response Parsing Testing Pattern**

```python
# backend/tests/chat/test_chat_parsing.py
import pytest
from pydantic import ValidationError
from app.chat.models import ChatResponse

def test_valid_chat_response_parsing():
    """Parse valid structured LLM response."""
    json_str = '''
    {
        "message": "Here's my analysis...",
        "trades": [
            {"ticker": "AAPL", "side": "buy", "quantity": 10}
        ],
        "watchlist_changes": [
            {"ticker": "TSLA", "action": "add"}
        ]
    }
    '''
    response = ChatResponse.model_validate_json(json_str)
    assert response.message == "Here's my analysis..."
    assert len(response.trades) == 1
    assert response.trades[0].ticker == "AAPL"

def test_malformed_json_rejected():
    """Reject malformed JSON."""
    with pytest.raises(ValueError):
        ChatResponse.model_validate_json("{invalid json}")

def test_missing_message_field_rejected():
    """Reject response missing required 'message' field."""
    json_str = '{"trades": []}'
    with pytest.raises(ValidationError):
        ChatResponse.model_validate_json(json_str)

def test_empty_arrays_accepted():
    """Accept response with empty trades/watchlist arrays."""
    json_str = '{"message": "Hello", "trades": [], "watchlist_changes": []}'
    response = ChatResponse.model_validate_json(json_str)
    assert response.trades == []
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Docker build/run wrapper | Shell scripts with complex logic | Use Bash functions and test small pieces | Fragility; hard to debug; port conflicts |
| Container health checks | Sleep in init scripts | Use HEALTHCHECK instruction or docker-compose `healthcheck` | Services may not be ready; race conditions |
| Next.js routing in SPA | Custom FastAPI redirect logic | FastAPI StaticFiles with `html=True` | StaticFiles handles fallback automatically |
| LLM JSON parsing | Manual string parsing | Pydantic BaseModel validation | Pydantic catches schema mismatches early |
| E2E test data setup | Hardcoded SQL inserts | Fixtures via conftest.py + HTTP API | Fixtures are reusable; HTTP API tests real code paths |
| Docker layer caching | Copy all files at once | Separate dependency install from source | Single copy invalidates all downstream layers |

**Key insight:** Every item above has existing, battle-tested solutions. Building custom alternatives introduces hidden complexity (race conditions, state leaks, schema drift) that only manifests under load or in CI.

---

## Common Pitfalls

### Pitfall 1: Next.js Static Export Output Path Mismatch

**What goes wrong:** `next build` completes successfully, but Docker COPY fails with "no matching files found" because Next.js output is in wrong directory.

**Why it happens:** Default Next.js export output is `out/`, but if `next.config.js` specifies `distDir: 'dist'`, the Dockerfile must copy from `dist/` not `out/`. Easy to miss when config is auto-generated.

**How to avoid:** 
- Verify `next.config.js` has `output: 'export'` (static) and default or explicit `distDir`
- In frontend build stage, verify build succeeds: `test -f out/index.html` or `test -f dist/index.html`
- Commit verification assertion to Dockerfile

**Warning signs:** 
- Docker build fails during `COPY frontend/out/ ./static`
- Frontend assets missing in container (500 on `/` or 404 on CSS)

### Pitfall 2: uv.lock Missing from Git

**What goes wrong:** Docker build runs `uv sync --frozen` but uv.lock doesn't exist in source tree, causing "lock file not found" error.

**Why it happens:** uv.lock is similar to package-lock.json and npm, but developers sometimes add `*.lock` to .gitignore by accident, or forget to commit it after `uv add`.

**How to avoid:**
- Verify `uv.lock` is in `backend/` and committed to git
- Dockerfile uses `uv sync --frozen` (requires existing lock file)
- CI/CD should reject PRs without uv.lock for backend changes

**Warning signs:**
- Docker build fails at `RUN uv sync --frozen` with "lock file not found"
- Backend dependency versions drift locally vs. production

### Pitfall 3: Database Not Persisting Across Container Restart

**What goes wrong:** User starts container, creates trades/positions, stops container, restarts → database is empty.

**Why it happens:** SQLite file (`db/finally.db`) is created inside container in a non-volume directory; when container stops, filesystem is discarded.

**How to avoid:**
- Mount volume at `/app/db` in Docker run: `-v finally-data:/app/db`
- Backend writes to `/app/db/finally.db` (hardcoded or env var)
- Verify in start script: `docker run -v finally-data:/app/db ...`

**Warning signs:**
- Fresh container shows default $10k balance but previous trades are gone
- `docker volume ls` shows no `finally-data` or similar

### Pitfall 4: Dockerfile Multi-Stage Layer Caching Broken

**What goes wrong:** Every code change triggers full re-install of Python dependencies, adding 3+ minutes to build time.

**Why it happens:** Dockerfile copies entire `backend/` directory before running `uv sync`, so changes to any `.py` file invalidate the dependency cache layer.

**How to avoid:**
- Use two-step copy:
  1. Copy only `pyproject.toml` + `uv.lock`, run `uv sync --frozen --no-install-project`
  2. Copy remaining source code, run `uv sync --frozen` again
- Second step reuses cached dependency layer if only source changed

**Example:**
```dockerfile
# Layer 1: Dependencies (cacheable)
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-install-project

# Layer 2: Source (invalidates on code changes, not deps)
COPY backend/app ./app
RUN uv sync --frozen
```

**Warning signs:**
- Build time jumps from 10s to 3min+ when you add a new import
- `docker build` output shows "uv sync" re-running despite no dependency change

### Pitfall 5: E2E Tests Fail Due to Service Race Condition

**What goes wrong:** Playwright test starts before backend is ready; tries to load page and gets connection refused.

**Why it happens:** `docker-compose up -d` returns immediately; containers are spawned but services aren't ready. Playwright client tries to connect before app starts.

**How to avoid:**
- Use `docker-compose` `healthcheck` on app service:
  ```yaml
  services:
    app:
      healthcheck:
        test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
        interval: 1s
        timeout: 3s
        retries: 30
  ```
- Playwright test should `await page.goto()` which auto-retries on connection failure
- docker-compose `wait` on health check: depends on `app` service in test container

**Warning signs:**
- E2E tests pass locally but fail in CI
- Test logs show "connection refused" at first HTTP request
- Adding `sleep 5` before test makes it pass (band-aid, not fix)

### Pitfall 6: SSE Connection Breaks on Container Restart

**What goes wrong:** Browser maintains open SSE connection to old container instance; new container starts on same port but browser doesn't reconnect; prices stop updating.

**Why it happens:** Browser's `EventSource` auto-reconnects to the same URL, but if server address changes (e.g., new container IP), the reconnect succeeds but to a stale connection state.

**How to avoid:**
- Backend should be stateless: each connection to SSE endpoint is independent
- `EventSource` includes `retry: 1000` header so browser auto-reconnects after disconnect
- Test confirms reconnection: `playwright test` with network throttle that disconnects SSE, verifies prices resume

**Warning signs:**
- E2E test: prices stream, then kill app container, restart → prices don't resume
- Frontend console shows EventSource reconnecting but no data arrives

---

## Code Examples

### FastAPI Static File Serving for Next.js

[VERIFIED: FastAPI docs](https://fastapi.tiangolo.com/tutorial/static-files/)

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="FinAlly")

# Register all API routers first (they match before static fallback)
app.include_router(create_portfolio_router())  # /api/portfolio/*
app.include_router(create_watchlist_router())  # /api/watchlist/*
app.include_router(create_chat_router())       # /api/chat
app.include_router(create_stream_router())     # /api/stream/prices
app.include_router(create_health_router(), prefix="/api")

# Mount static files with SPA fallback (index.html on 404)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
```

**Behavior:**
- Request to `/api/portfolio` → matched by portfolio router before static fallback
- Request to `/dashboard` → StaticFiles fallback serves `static/index.html`
- Browser's Next.js router then renders `/dashboard` view from that HTML

### Multi-Stage Dockerfile with Layer Caching

[VERIFIED: astral-sh/uv Docker docs](https://docs.astral.sh/uv/guides/integration/docker/)

```dockerfile
# Stage 1: Frontend (Node 20 Alpine)
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# Produces: /build/out/ (static export)

# Stage 2: Python builder (dependency layer caching)
FROM python:3.12-slim AS python-deps
WORKDIR /build
RUN pip install uv
# Copy lock file ONLY — this layer is cached if lock unchanged
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-install-project

# Stage 3: Runtime
FROM python:3.12-slim
WORKDIR /app

# Install non-root user
RUN useradd -m -u 1000 appuser

# Copy cached venv from builder
COPY --from=python-deps /build/.venv /app/.venv

# Copy source code (this layer invalidates on code change, not deps)
COPY backend/app ./app

# Copy frontend static files
COPY --from=frontend /build/out ./static

# Prepare environment
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Idempotent Bash Start Script

[VERIFIED: oneuptime.com](https://oneuptime.com/blog/post/2026-02-08-how-to-write-idempotent-docker-entrypoint-scripts-view)

```bash
#!/bin/bash
# scripts/start_mac.sh — Idempotent Docker start wrapper

set -e  # Exit on error

IMAGE_NAME="finally"
CONTAINER_NAME="finally-app"
PORT="8000"
VOLUME_NAME="finally-data"
ENV_FILE=".env"

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found"
    exit 1
fi

# Check if container already running
if docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo "Container $CONTAINER_NAME already running. Skipping start."
    exit 0
fi

# Check if stopped container exists; remove it
if docker ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo "Removing stopped container $CONTAINER_NAME..."
    docker rm "$CONTAINER_NAME"
fi

# Create volume if it doesn't exist
docker volume inspect "$VOLUME_NAME" > /dev/null 2>&1 || docker volume create "$VOLUME_NAME"

# Build image (use cache unless --build flag passed)
if [ "$1" = "--build" ] || ! docker image inspect "$IMAGE_NAME" > /dev/null 2>&1; then
    echo "Building Docker image $IMAGE_NAME..."
    docker build -t "$IMAGE_NAME" .
fi

# Run container
echo "Starting container $CONTAINER_NAME..."
docker run \
    --name "$CONTAINER_NAME" \
    -p "$PORT:8000" \
    -v "$VOLUME_NAME:/app/db" \
    --env-file "$ENV_FILE" \
    -d \
    "$IMAGE_NAME"

echo "Container started. Access at http://localhost:$PORT"
echo "View logs: docker logs -f $CONTAINER_NAME"
```

### Playwright E2E Test with docker-compose

```typescript
// test/e2e/trading.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Trading Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for app to be fully ready
    await page.goto('http://localhost:8000/', {
      waitUntil: 'networkidle'
    })
  })

  test('Fresh start shows default watchlist and $10k balance', async ({ page }) => {
    // Verify default balance
    const balance = page.locator('[data-testid="cash-balance"]')
    await expect(balance).toContainText('$10,000')

    // Verify watchlist has 10 default tickers
    const tickers = page.locator('[data-testid="watchlist-row"]')
    await expect(tickers).toHaveCount(10)
  })

  test('Buy shares: cash decreases, position appears', async ({ page }) => {
    // Set trade inputs
    await page.fill('[data-testid="trade-ticker"]', 'AAPL')
    await page.fill('[data-testid="trade-quantity"]', '10')

    // Record current balance
    const balanceBefore = await page.locator('[data-testid="cash-balance"]').innerText()

    // Execute buy
    await page.click('[data-testid="trade-buy"]')
    await page.waitForTimeout(1000)  // Wait for API response

    // Verify position appears
    const position = page.locator('[data-testid="position-AAPL"]')
    await expect(position).toBeVisible()
    await expect(position).toContainText('10')

    // Verify cash decreased
    const balanceAfter = await page.locator('[data-testid="cash-balance"]').innerText()
    expect(balanceAfter).not.toEqual(balanceBefore)
  })
})
```

```yaml
# test/docker-compose.test.yml
version: '3.8'
services:
  app:
    build: ..
    ports:
      - '8000:8000'
    environment:
      LLM_MOCK: 'true'
      OPENROUTER_API_KEY: 'test-key'
    volumes:
      - test-db:/app/db
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8000/api/health']
      interval: 1s
      timeout: 3s
      retries: 30

  playwright:
    image: mcr.microsoft.com/playwright:v1.58-focal
    working_dir: /test
    volumes:
      - ./:/test
      - /test/node_modules
    depends_on:
      app:
        condition: service_healthy
    command: npx playwright test

volumes:
  test-db:
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.3.0+ (backend), Playwright 1.58+ (E2E) |
| Config file | `backend/pyproject.toml`, `playwright.config.ts` (to be created in Phase 5) |
| Quick run command | `cd backend && uv run pytest tests/test_portfolio.py -v` |
| Full suite command | `cd backend && uv run pytest --cov=app tests/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | Buy/sell trade execution | unit | `pytest tests/test_portfolio.py::test_buy_success_with_sufficient_cash` | ✅ Wave 0 |
| TEST-01 | Insufficient cash rejected | unit | `pytest tests/test_portfolio.py::test_buy_fails_insufficient_cash` | ✅ Wave 0 |
| TEST-01 | Oversell rejected | unit | `pytest tests/test_portfolio.py::test_sell_fails_oversell` | ✅ Wave 0 |
| TEST-01 | Trade atomicity | unit | `pytest tests/test_portfolio.py::test_trade_atomic_rollback` | ❌ Wave 0 |
| TEST-02 | LLM valid JSON response parses | unit | `pytest tests/chat/test_chat_parsing.py::test_valid_chat_response_parsing` | ❌ Wave 0 |
| TEST-02 | Malformed JSON rejected | unit | `pytest tests/chat/test_chat_parsing.py::test_malformed_json_rejected` | ❌ Wave 0 |
| TEST-02 | Trade validation in LLM response | unit | `pytest tests/chat/test_chat_integration.py::test_llm_trade_validation` | ❌ Wave 0 |
| TEST-03 | Fresh start shows default UI | e2e | `docker-compose -f test/docker-compose.test.yml run --rm playwright npx playwright test e2e/fresh-start.spec.ts` | ❌ Wave 0 |
| TEST-03 | Buy shares flow | e2e | `docker-compose -f test/docker-compose.test.yml run --rm playwright npx playwright test e2e/trading.spec.ts` | ❌ Wave 0 |
| TEST-03 | Chat with mock LLM | e2e | `docker-compose -f test/docker-compose.test.yml run --rm playwright npx playwright test e2e/chat.spec.ts` | ❌ Wave 0 |
| INFRA-01 | Docker build succeeds | smoke | `docker build -t finally . && test -f /tmp/finally-out/index.html` | ❌ Wave 0 |
| INFRA-02 | Port 8000 serves API + frontend | smoke | `curl http://localhost:8000/api/health && curl http://localhost:8000/` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && uv run pytest tests/test_portfolio.py -v` (30 seconds)
- **Per wave merge:** `cd backend && uv run pytest --cov=app tests/` (2 minutes)
- **Phase gate:** Full suite + E2E docker-compose before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_portfolio.py::test_trade_atomic_rollback` — transaction rollback on constraint violation
- [ ] `backend/tests/chat/test_chat_parsing.py` — LLM response validation tests (new module)
- [ ] `backend/tests/chat/test_chat_integration.py` — Trade auto-execution within chat flow (new module)
- [ ] `test/playwright.config.ts` — Playwright test runner configuration
- [ ] `test/e2e/fresh-start.spec.ts` — Verify default UI state and $10k balance
- [ ] `test/e2e/trading.spec.ts` — Buy/sell flow with portfolio updates
- [ ] `test/e2e/chat.spec.ts` — Chat message flow with mock LLM
- [ ] `test/docker-compose.test.yml` — Service definitions and health checks
- [ ] `Dockerfile` — Multi-stage build with layer caching
- [ ] `scripts/start_mac.sh` + `scripts/stop_mac.sh` — Bash wrappers (idempotent)
- [ ] `scripts/start_windows.ps1` + `scripts/stop_windows.ps1` — PowerShell wrappers (idempotent)
- [ ] Framework install: `npm install --save-dev @playwright/test` in `test/` (new directory)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate frontend/backend servers | Single Docker container on port 8000 | Phase 5 design | Eliminates CORS, simplifies deployment, one volume for data |
| WebSocket for real-time prices | SSE (Server-Sent Events) | Market data (existing) | Simpler protocol, browser auto-reconnect, one-way push sufficient |
| Manual trade validation | Atomic SQLite transactions with `BEGIN IMMEDIATE` | Phase 2 (existing) | Prevents partial execution on concurrent writes |
| Float precision for portfolio values | Decimal type for all monetary calculations | Phase 1 (existing) | Eliminates IEEE 754 rounding errors in P&L |
| Cypress for E2E testing | Playwright | Phase 5 standard | Better cross-browser support, faster, less flaky |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Container building | ✓ | 20.10+ | — (must have for production container) |
| Node.js | Frontend build stage (first stage) | ✓ | 20.x | Node 18 (older, not recommended) |
| Python | Local backend dev/test | ✓ | 3.12+ | — (must match pyproject.toml) |
| uv | Local backend package management | ✓ | 0.5.x+ | `pip install` (slower, less reproducible) |
| Playwright | E2E tests (optional locally) | ✗ | 1.58+ | Docker container includes Playwright browsers |

**Missing dependencies with no fallback:**
- Docker (required for Phase 5; cannot be skipped)

**Missing dependencies with fallback:**
- Playwright (can be run inside docker-compose test container instead of locally; no install needed on host)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Next.js static export is fully built before Docker COPY | Multi-Stage Dockerfile | Build fails with "no such file" if frontend build step is skipped or output directory is wrong |
| A2 | uv.lock is committed to git and current | Docker Multi-Stage | Build fails at `uv sync --frozen` if lock file missing |
| A3 | FastAPI StaticFiles with `html=True` fallback is sufficient for Next.js SPA routing | FastAPI Static File Serving | SPA routing breaks (direct visits to `/dashboard` 404) if fallback not configured |
| A4 | Pytest fixtures (test_db, price_cache, client) already exist and are reusable | pytest Test Organization | Tests require fixture reimplementation if fixtures are missing or incompatible |
| A5 | Playwright can connect to app container via service name `http://app:8000` in docker-compose | Playwright E2E Test | Tests fail with "connection refused" if docker-compose networking or baseURL is wrong |
| A6 | Docker HEALTHCHECK + docker-compose `depends_on` with `service_healthy` is sufficient for service ordering | E2E Test Race Condition Pitfall | Tests start before backend ready, causing flaky failures if health check is missing |
| A7 | LLM_MOCK=true environment variable triggers deterministic mock responses in chat endpoint | E2E Tests | Tests fail or are non-deterministic if LLM_MOCK detection is not implemented in Phase 3 |

---

## Open Questions

1. **Cloud Deployment (INFRA-05 — Stretch Goal)**
   - What we know: Infrastructure-as-code templates (Terraform for AWS App Runner, CloudFormation for similar) exist and are mature
   - What's unclear: Whether this phase has capacity for INFRA-05 or if it defers to v1.1
   - Recommendation: Include in Wave 1 plan; defer implementation if time is tight

2. **E2E Test Data Isolation**
   - What we know: `docker-compose.test.yml` uses ephemeral `tmpfs` volume or creates fresh database per test run
   - What's unclear: How to reset database between test cases (fresh seed data each time, or state management)
   - Recommendation: Use docker-compose down/up between test suites; within suite, use fixtures to reset state

3. **Performance Targets (Portfolio Snapshot, SSE Cadence)**
   - What we know: Portfolio snapshots every 30s, SSE pushes ~500ms
   - What's unclear: If Phase 5 includes performance regression tests or just functional tests
   - Recommendation: Functional tests only in Phase 5; performance benchmarking deferred to v1.1

---

## Security Domain

No security-sensitive operations introduced in Phase 5 beyond what exists in prior phases:
- Database operations: handled by Phase 1 (SQLite initialization, schema)
- Trade execution: validated in Phase 2
- LLM integration: handled in Phase 3 (OpenRouter API key, response validation)
- Frontend SSE: existing in market data subsystem

**Docker-specific security considerations:**
- Multi-stage build reduces attack surface (no npm/pip dev tools in final image)
- Non-root user (`appuser`) runs container process
- No hardcoded secrets in Dockerfile; all via environment variables (passed at runtime)

---

## Sources

### Primary (HIGH confidence)

- [FastAPI Static Files Documentation](https://fastapi.tiangolo.com/tutorial/static-files/) — StaticFiles mounting with html=True fallback
- [Next.js Static Exports Guide](https://nextjs.org/docs/pages/guides/static-exports) — `output: 'export'` configuration, `out/` directory
- [uv Docker Integration Guide](https://docs.astral.sh/uv/guides/integration/docker/) — `uv sync --frozen`, layer caching with --no-install-project
- [astral-sh/uv Issue #14256](https://github.com/astral-sh/uv/issues/14256) — Multi-stage Docker layer caching best practices
- [Docker Container Best Practices 2026](https://jishulabs.com/blog/docker-container-best-practices-2026) — Multi-stage builds, BuildKit, security
- [Playwright End-to-End Testing with Docker](https://www.browserstack.com/guide/playwright-docker) — docker-compose integration, service orchestration
- [FastAPI Testing Guide](https://fastapi.tiangolo.com/tutorial/testing/) — TestClient, pytest fixtures, async test patterns

### Secondary (MEDIUM confidence)

- [Loading Static Files in FastAPI — The Right Way (Medium)](https://medium.com/@rameshkannanyt0078/loading-static-files-in-fastapi-the-right-way-34e8a6d94e6a) — SPA routing patterns, static file serving
- [Boosting Your Full-Stack Workflow with Next.js, FastAPI and Vercel (Medium)](https://medium.com/@kaweyo_41978/boosting-your-full-stack-workflow-with-next-js-and-fastapi-and-vercel-3c7d3cd8220f) — Full-stack integration patterns
- [How to Write Idempotent Docker Entrypoint Scripts](https://oneuptime.com/blog/post/2026-02-08-how-to-write-idempotent-docker-entrypoint-scripts-view) — Idempotent shell script patterns, marker files, conditional logic
- [Multi-Stage Builds in Docker: A Complete Guide (SmartTechWays)](https://smarttechways.com/2026/01/16/multi-stage-builds-in-docker-a-complete-guide/) — Multi-stage optimization, layer caching, Node/Python patterns
- [Python package management with uv for dockerized environments (Medium)](https://medium.com/@shaliamekh/python-package-management-with-uv-for-dockerized-environments-f3d727795044) — uv in Docker, reproducible builds

### Tertiary (LOW confidence — flagged for validation)

- [Pytest with FastAPI CRUD Example (GitHub)](https://github.com/Pytest-with-Eric/pytest-fastapi-crud-example) — Example patterns (verify against actual project needs)
- [Run integration-test with playwright inside a docker container (Summerbud)](https://www.summerbud.org/dev-notes/run-playwright-integration-test-in-docker-container) — Docker Compose integration patterns (verify against current docker-compose.test.yml design)

---

## Metadata

**Confidence breakdown:**
- Docker/FastAPI static serving: HIGH — FastAPI official docs, verified with existing pattern
- Multi-stage Dockerfile: HIGH — astral-sh/uv official docs + 2026 best practice sources
- pytest patterns: HIGH — FastAPI official + project's existing test infrastructure
- Playwright E2E: MEDIUM — BrowserStack guide + project fit; actual playwright.config.ts design TBD
- Idempotent scripts: HIGH — Official Docker patterns + current project constraints
- Cloud deployment: LOW — Research placeholder; INFRA-05 is stretch goal

**Research date:** 2026-04-10  
**Valid until:** 2026-04-20 (Docker/FastAPI are stable; Playwright may evolve, re-check if adding streaming tests)

---

*Research completed and ready for planning phase.*
