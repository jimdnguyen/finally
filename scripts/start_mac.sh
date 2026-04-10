#!/bin/bash
# scripts/start_mac.sh — Idempotent Docker start wrapper
# Usage: ./scripts/start_mac.sh [--build]
# --build: force rebuild of image (optional)

set -e  # Exit on error

# Configuration
IMAGE_NAME="finally"
CONTAINER_NAME="finally-app"
PORT="8000"
VOLUME_NAME="finally-data"
ENV_FILE=".env"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'  # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    log_error "$ENV_FILE not found"
    echo "Please create $ENV_FILE from .env.example:"
    echo "  cp .env.example $ENV_FILE"
    echo "  # Edit $ENV_FILE and add your OPENROUTER_API_KEY"
    exit 1
fi

log_info "Found $ENV_FILE"

# Step 2: Check if container is already running
if docker ps --format "table {{.Names}}" 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
    log_warn "Container $CONTAINER_NAME already running"
    log_info "Access at http://localhost:$PORT"
    log_info "View logs: docker logs -f $CONTAINER_NAME"
    exit 0
fi

# Step 3: Check if stopped container exists; remove it
if docker ps -a --format "table {{.Names}}" 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
    log_warn "Removing stopped container $CONTAINER_NAME..."
    docker rm "$CONTAINER_NAME" || log_error "Failed to remove container"
fi

# Step 4: Create volume if it doesn't exist
if ! docker volume inspect "$VOLUME_NAME" > /dev/null 2>&1; then
    log_info "Creating Docker volume $VOLUME_NAME..."
    docker volume create "$VOLUME_NAME"
else
    log_info "Using existing Docker volume $VOLUME_NAME"
fi

# Step 5: Build image (unless --build not passed and image exists)
if [ "$1" = "--build" ] || ! docker image inspect "$IMAGE_NAME" > /dev/null 2>&1; then
    log_info "Building Docker image $IMAGE_NAME..."
    docker build -t "$IMAGE_NAME" . || {
        log_error "Docker build failed"
        exit 1
    }
else
    log_info "Using existing Docker image $IMAGE_NAME"
fi

# Step 6: Run container
log_info "Starting container $CONTAINER_NAME..."
docker run \
    --name "$CONTAINER_NAME" \
    -p "$PORT:8000" \
    -v "$VOLUME_NAME:/app/db" \
    --env-file "$ENV_FILE" \
    -d \
    "$IMAGE_NAME" || {
    log_error "Failed to start container"
    exit 1
}

# Step 7: Wait for container to be healthy
log_info "Waiting for app to be ready (up to 30 seconds)..."
for i in {1..30}; do
    if docker exec "$CONTAINER_NAME" curl -f http://localhost:8000/api/health > /dev/null 2>&1; then
        log_info "App is healthy!"
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "App failed to become healthy within 30 seconds"
        log_info "Check logs: docker logs $CONTAINER_NAME"
        exit 1
    fi
    echo -n "."
    sleep 1
done

# Step 8: Print access instructions
echo ""
log_info "Container started successfully!"
echo ""
echo "Access the app at: ${GREEN}http://localhost:$PORT${NC}"
echo ""
echo "Useful commands:"
echo "  View logs:    docker logs -f $CONTAINER_NAME"
echo "  Stop:         ./scripts/stop_mac.sh"
echo "  Rebuild:      ./scripts/start_mac.sh --build"
echo ""
