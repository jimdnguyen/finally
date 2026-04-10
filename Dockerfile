# Stage 1: Frontend builder (Node 20 Alpine)
FROM node:20-alpine AS frontend

WORKDIR /build

COPY frontend/package*.json ./

RUN npm ci

COPY frontend/ ./

RUN npm run build

# Verify frontend build output
RUN test -f ./out/index.html


# Stage 2: Python dependency builder (Python 3.12 slim)
FROM python:3.12-slim AS python-deps

RUN pip install uv

WORKDIR /build

COPY backend/pyproject.toml backend/uv.lock ./

RUN uv sync --frozen --no-install-project


# Stage 3: Runtime (Python 3.12 slim)
FROM python:3.12-slim

# Install curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Copy venv from dependencies builder
COPY --from=python-deps /build/.venv /app/.venv

# Copy backend application code
COPY backend/app ./app

# Copy frontend static build output
COPY --from=frontend /build/out ./static

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

# Ensure appuser owns all application files
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port 8000
EXPOSE 8000

# Health check
HEALTHCHECK --interval=1s --timeout=3s --retries=30 \
    CMD ["curl", "-f", "http://localhost:8000/api/health"] || exit 1

# Start FastAPI application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
