# Technology Stack

**Last updated:** 2026-04-09
**Focus:** tech

## Summary

FinAlly is a full-stack trading platform built with Python FastAPI backend (serving static Next.js exports) and a real-time price streaming system via SSE. The market data layer is architecture-agnostic and can source prices from an internal GBM simulator (default) or real-time Polygon.io data via the Massive API library. The project uses `uv` for Python dependency management and SQLite for persistent data storage.

## Languages

**Primary:**
- Python 3.12+ - Backend API, market data simulation, LLM integration
- TypeScript - Frontend (Next.js static export, not yet implemented)

**Secondary:**
- SQL (SQLite) - Database schema and seed data

## Runtime

**Environment:**
- Python 3.12+
- Node.js 20+ (for frontend build, not runtime)

**Package Managers:**
- `uv` 0.5.x+ - Python package manager and runner (`backend/`)
- `npm` - Frontend dependencies (frontend not yet scaffolded)

**Lockfiles:**
- `backend/uv.lock` - Complete reproducible Python dependency tree (147.6 KB, 38 packages)
- Frontend lockfile: Not yet created (frontend directory empty)

## Frameworks

**Core:**
- FastAPI 0.115.0+ - Web API framework with async support
- Starlette - Underlying HTTP routing and SSE support (implicit via FastAPI)
- Uvicorn 0.32.0+ - ASGI application server with standard extras (HTTP/WebSocket/uvloop)

**Testing:**
- pytest 8.3.0+ - Test runner
- pytest-asyncio 0.24.0+ - Async test support (using auto mode)
- pytest-cov 5.0.0+ - Test coverage reporting

**Linting/Formatting:**
- ruff 0.7.0+ - Fast Python linter and formatter
- Configuration: `pyproject.toml` with line-length 100, target Python 3.12, rules: E/F/I/N/W

**Development:**
- Rich 13.0.0+ - Terminal formatting and live UI (used in `market_data_demo.py`)

## Key Dependencies

**Critical:**
- `fastapi` 0.115.0+ - REST API and SSE endpoint creation
- `uvicorn[standard]` 0.32.0+ - ASGI server with uvloop support
- `massive` 1.0.0+ - Polygon.io REST client for real market data polling (conditional on `MASSIVE_API_KEY`)
- `numpy` 2.0.0+ - Numeric operations for GBM simulator (Cholesky decomposition)
- `pydantic` (indirect) - Data validation via FastAPI
- `python-dotenv` - Environment variable loading from `.env` file

**Infrastructure:**
- `h11` - HTTP/1.1 protocol layer (FastAPI/Uvicorn)
- `anyio` - Async I/O abstraction layer
- `httptools` - HTTP parsing (uvloop optimization)
- `websockets` - WebSocket support (implicit dependency, not used but available)
- `watchfiles` - File watching for dev reload

**Utilities:**
- `rich` 13.0.0+ - Rich terminal formatting for demo and logging output
- `click` - CLI utilities
- `pyyaml` - YAML parsing (dependency chain)

## Configuration

**Environment:**
- Configuration via `.env` file (not version controlled; `.env.example` in repo)
- Loaded via `python-dotenv` in backend startup
- Python path: `PYTHONPATH` includes `backend/` for module imports

**Build:**
- Python project: `backend/pyproject.toml`
  - Build backend: `hatchling`
  - Package: `app`
  - Pytest configuration: testpaths `tests`, auto asyncio mode
  - Ruff config: line-length 100, target py312, selected rules E/F/I/N/W (ignoring E501)
- Frontend: Not yet scaffolded (will use `create-vite` with TypeScript template per project docs)

**Runtime Artifacts:**
- Database: `db/finally.db` (SQLite file, volume-mounted in Docker)
- Logs: stdout/stderr via Rich console
- No configuration files needed at runtime (all via env vars)

## Platform Requirements

**Development:**
- Python 3.12+ with pip (or use `uv` directly)
- Node.js 20+ (for frontend build when scaffolded)
- SQLite 3+ (bundled with Python)
- Docker (for local containerized testing)

**Production (Docker):**
- Multi-stage Dockerfile (planned):
  - Stage 1: Node 20 slim → build Next.js static export
  - Stage 2: Python 3.12 slim → run FastAPI server
- Single port: 8000
- Database volume mount: `/app/db` maps to `db/finally.db`
- Environment file: `.env` passed via `--env-file` to `docker run`

## Versions Summary

| Component | Version | Notes |
|-----------|---------|-------|
| Python | 3.12+ | Required via pyproject.toml |
| FastAPI | 0.115.0+ | Latest stable, async first |
| Uvicorn | 0.32.0+ | With standard extras (uvloop, httptools) |
| Massive (Polygon.io) | 1.0.0+ | Market data REST client |
| NumPy | 2.0.0+ | For GBM math (Cholesky, random sampling) |
| pytest | 8.3.0+ | Full test suite support |
| ruff | 0.7.0+ | Modern Python linter |
| Node | 20+ | Frontend build (not yet active) |

## Build & Deploy

**Local Development:**
```bash
cd backend
uv sync --extra dev                    # Install deps + dev tools
uv run market_data_demo.py              # Run market data demo
uv run --extra dev pytest -v            # Run all tests
uv run --extra dev ruff check app tests # Lint
```

**Docker:**
- Uses Python 3.12 slim base image
- Installs `uv` within container
- Copies `pyproject.toml` and `uv.lock`
- Runs `uv sync` to install dependencies
- Exposes port 8000
- Mounts `db/` volume for SQLite persistence

**CI/CD:**
- Not yet configured in repo
- GitHub Actions available in `.github/workflows/` (added but not configured for this phase)

---

*Stack analysis: 2026-04-09*
