#!/bin/bash
set -e
CONTAINER_NAME="finally-app"
IMAGE_NAME="finally-app"

# Check for --build flag or if image doesn't exist
if [[ "$1" == "--build" ]] || ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
    echo "Building FinAlly..."
    docker build -t "$IMAGE_NAME" "$(dirname "$0")/.."
fi

# Stop existing container if running
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

# Run container
docker run -d \
    --name "$CONTAINER_NAME" \
    -p 8000:8000 \
    -v finally-data:/app/db \
    --env-file "$(dirname "$0")/../.env" \
    "$IMAGE_NAME"

echo "FinAlly is running at http://localhost:8000"

# Open browser (macOS)
if command -v open &>/dev/null; then
    sleep 2 && open http://localhost:8000 &
fi
