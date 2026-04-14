# Story 4.1: Dockerfile & Container Build

## Status: review

## Story

As a user who wants to run the app,
I want a single Docker command to build and start everything,
so that there's no manual setup beyond providing an API key.

## Acceptance Criteria

- **AC1** — Given the `Dockerfile` exists, when `docker build -t finally .` runs, then Stage 1 (Node 20 slim) installs frontend deps and runs `npm run build` producing `frontend/out/`; Stage 2 (Python 3.12 slim) installs uv, copies backend, runs `uv sync`, copies `frontend/out/` into the image as `backend/static/`.
- **AC2** — Given the image is built, when `docker run -v finally-data:/app/db -p 8000:8000 --env-file .env finally` runs, then the app starts on port 8000, the SQLite DB initializes if missing, and `GET /api/health` returns `{"status": "ok"}`.
- **AC3** — Given the container runs with `MASSIVE_API_KEY` absent or empty, when the market data task starts, then the built-in simulator runs without error (no crash, prices stream normally).
- **AC4** — Given `.env.example` is committed to the repo, when inspecting it, then it contains `OPENROUTER_API_KEY`, `MASSIVE_API_KEY`, and `LLM_MOCK` variables with placeholder values and comments — no real keys.
- **AC5** — Given the container stops and restarts with the same volume, when the app loads, then all portfolio state (positions, cash, watchlist, trades) is preserved.

---

## Dev Notes

### Multi-Stage Dockerfile Architecture

**Stage 1 — Frontend Build (Node 20 slim):**
```dockerfile
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# Produces /app/frontend/out/ (static export)
```

**Stage 2 — Python Runtime (Python 3.12 slim):**
```dockerfile
FROM python:3.12-slim AS runtime
# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv
WORKDIR /app
# Copy backend
COPY backend/ ./
# Install dependencies
RUN uv sync --no-dev
# Copy frontend build output as static files
COPY --from=frontend-builder /app/frontend/out ./static/
# Create db directory for volume mount
RUN mkdir -p /app/db
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Static File Serving — Already Implemented

The backend already serves static files from `backend/static/` directory:

```python
# backend/app/main.py:26, 78-79
STATIC_DIR = Path(__file__).parent.parent / "static"
# ...
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
```

The `html=True` flag enables SPA fallback (returns `index.html` for non-file routes).

### Volume Mount Path

- SQLite DB path in code: `db/finally.db` (relative to backend working directory)
- Backend config at `backend/app/db/config.py` defines `DB_PATH`
- Container command: `-v finally-data:/app/db`
- The DB file will be at `/app/db/finally.db` inside the container

### Environment Variables

**Required:**
- `OPENROUTER_API_KEY` — Required for live AI chat (LLM calls)

**Optional:**
- `MASSIVE_API_KEY` — If set, uses real Polygon.io market data; if absent, simulator runs
- `LLM_MOCK` — If `true`, returns deterministic mock AI responses (for E2E tests)

### Health Endpoint

Already implemented at `backend/app/health/router.py`:
```python
@router.get("/health")
async def health():
    return {"status": "ok"}
```
Registered at `/api/health` in `main.py:72`.

### .env.example Format

```bash
# Required: OpenRouter API key for AI chat functionality
# Get one at https://openrouter.ai/keys
OPENROUTER_API_KEY=your-openrouter-api-key-here

# Optional: Massive (Polygon.io) API key for real market data
# If not set, the built-in market simulator is used (recommended for demos)
MASSIVE_API_KEY=

# Optional: Set to "true" for deterministic mock LLM responses (for testing)
LLM_MOCK=false
```

### Current Dependencies

**Backend (`backend/pyproject.toml`):**
- Python 3.12+
- fastapi, uvicorn[standard], numpy, massive, rich, aiosqlite, litellm
- Dev: pytest, pytest-asyncio, pytest-cov, ruff

**Frontend (`frontend/package.json`):**
- Node 20+ (Next.js 16.2.3, React 19)
- Runtime: lightweight-charts, zustand, react-hot-toast
- Build: next build produces static export in `out/`

### Build Output Structure

```
frontend/out/
├── index.html
├── _next/
│   └── static/
│       ├── chunks/
│       ├── css/
│       └── media/
└── ...
```

This entire directory gets copied to `backend/static/` in the Docker image.

### Docker Build Context

The Dockerfile must be at project root (`finally/Dockerfile`) so the build context includes both `frontend/` and `backend/`:

```
finally/
├── Dockerfile
├── frontend/
└── backend/
```

### Testing the Build

After implementing, verify:
1. `docker build -t finally .` — completes without error
2. `docker run --rm -p 8000:8000 -v finally-data:/app/db --env-file .env finally` — starts successfully
3. `curl http://localhost:8000/api/health` — returns `{"status": "ok"}`
4. Open `http://localhost:8000` — loads the frontend SPA
5. Prices stream in the watchlist (simulator mode, no MASSIVE_API_KEY needed)

### Architecture References

- **ARCH-7**: FastAPI serves static Next.js export via `StaticFiles(html=True)`; API routes registered before static mount so `/api/*` takes precedence
- **ARCH-17**: Multi-stage Dockerfile: Node 20 slim (frontend build) → Python 3.12 slim (runtime)
- **ARCH-19**: `.env.example` committed with placeholder values
- **NFR8**: App starts cleanly from fresh Docker volume with no manual DB setup
- **NFR9**: All portfolio state persists across container restarts via mounted volume
- **NFR14**: Absent `MASSIVE_API_KEY` → simulator fallback, no error
- **FR34**: Single Docker command launch
- **FR35**: Health check endpoint

### Previous Story Context

This is the first story in Epic 4. Epics 1-3 are complete:
- All backend API endpoints implemented and tested (167 tests pass)
- All frontend components implemented and tested (136 tests pass)
- Database initialization, SSE streaming, portfolio, chat — all working
- Pre-Epic 4 cleanup completed (5 tech debt items fixed)

The dev agent only needs to create Docker/deployment files — no application code changes needed.

---

## Tasks / Subtasks

- [x] Task 1 — Create `.env.example` (AC4)
  - [x] 1.1 Create `finally/.env.example` with `OPENROUTER_API_KEY`, `MASSIVE_API_KEY`, `LLM_MOCK` variables
  - [x] 1.2 Include descriptive comments and placeholder values (no real keys)
  - [x] 1.3 Verify `.env.example` is not in `.gitignore` (it should be committed)

- [x] Task 2 — Create Dockerfile (AC1)
  - [x] 2.1 Create `finally/Dockerfile` with two stages
  - [x] 2.2 Stage 1: Node 20 slim, copy frontend, `npm ci`, `npm run build`
  - [x] 2.3 Stage 2: Python 3.12 slim, install uv, copy backend, `uv sync --no-dev`
  - [x] 2.4 Copy frontend build output (`frontend/out/`) to `backend/static/`
  - [x] 2.5 Create `/app/db` directory for volume mount
  - [x] 2.6 Expose port 8000, set CMD to run uvicorn

- [x] Task 3 — Build and test container (AC2, AC3)
  - [x] 3.1 Run `docker build -t finally .` — verify completes successfully
  - [x] 3.2 Run container with volume and env-file — verify app starts
  - [x] 3.3 Test `GET /api/health` returns `{"status": "ok"}`
  - [x] 3.4 Test frontend loads at `http://localhost:8000`
  - [x] 3.5 Test prices stream (simulator mode, no MASSIVE_API_KEY)

- [x] Task 4 — Test state persistence (AC5)
  - [x] 4.1 With container running, execute a trade via the UI or API
  - [x] 4.2 Stop and remove container (keep volume)
  - [x] 4.3 Start new container with same volume
  - [x] 4.4 Verify trade/position persists

- [x] Task 5 — Final verification
  - [x] 5.1 Run full backend test suite (167 tests)
  - [x] 5.2 Run full frontend test suite (136 tests)
  - [x] 5.3 Confirm no regressions

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Initial Docker build failed due to ghcr.io auth for uv image — fixed by using `pip install uv`
- Frontend build failed with TypeScript error in MainChart.tsx — fixed by adding `LineData<Time>` type casts
- Database persistence failed — DB_PATH resolved to `/db/finally.db` instead of `/app/db/finally.db`. Fixed by adding `DATABASE_PATH` env var in Dockerfile

### Completion Notes List

- Created `.env.example` with OPENROUTER_API_KEY, MASSIVE_API_KEY, LLM_MOCK variables
- Created multi-stage Dockerfile: Node 20 slim (frontend build) → Python 3.12 slim (runtime)
- Used `pip install uv` instead of `COPY --from=ghcr.io/astral-sh/uv:latest` to avoid auth issues
- Added `DATABASE_PATH=/app/db/finally.db` env var to fix volume persistence path
- Fixed MainChart.tsx type error by casting SparklinePoint[] to LineData<Time>[]
- All 5 ACs verified: build succeeds, container runs, health returns ok, simulator works, state persists
- All tests pass: 167 backend, 136 frontend

### File List

- `.env.example` — Created: env var template with placeholder values
- `Dockerfile` — Created: multi-stage build (Node 20 slim → Python 3.12 slim)
- `backend/app/db/config.py` — Modified: added DATABASE_PATH env var support
- `frontend/src/components/layout/MainChart.tsx` — Modified: added LineData<Time> type casts

### Review Findings

- [x] [Review][Patch] Missing `curl` in Python image — healthcheck fails [Dockerfile:11-18] ✓ fixed
