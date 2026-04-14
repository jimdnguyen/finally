# Stage 1: Frontend Build (Node 20 slim)
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# Produces /app/frontend/out/ (static export)

# Stage 2: Python Runtime (Python 3.12 slim)
FROM python:3.12-slim AS runtime
# Install curl for healthcheck and uv for Python package management
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN pip install uv
WORKDIR /app
# Copy backend
COPY backend/ ./
# Install dependencies
RUN uv sync --no-dev
# Copy frontend build output as static files
COPY --from=frontend-builder /app/frontend/out ./static/
# Create db directory for volume mount
RUN mkdir -p /app/db
# Set database path for volume persistence
ENV DATABASE_PATH=/app/db/finally.db
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
