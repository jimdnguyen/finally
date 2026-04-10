# Stage 1: Build Next.js frontend
FROM node:20-slim AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build
# Output at /build/frontend/out/

# Stage 2: Python backend
FROM python:3.12-slim AS final
# Install uv
RUN pip install uv
WORKDIR /app
# Install backend dependencies (README.md required by hatchling build)
COPY backend/pyproject.toml backend/uv.lock backend/README.md ./backend/
RUN cd backend && uv sync --no-dev --frozen
# Copy backend source
COPY backend/ ./backend/
# Copy frontend static export
COPY --from=frontend-builder /build/frontend/out ./static/
# Create db directory
RUN mkdir -p /app/db
EXPOSE 8000
CMD ["uv", "run", "--directory", "/app/backend", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
