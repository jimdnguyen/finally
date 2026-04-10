#!/bin/bash
# scripts/stop_mac.sh — Stop and remove the running container
# Note: Volume persists (data is preserved)
# Usage: ./scripts/stop_mac.sh

set -e

# Configuration
CONTAINER_NAME="finally-app"
VOLUME_NAME="finally-data"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if container exists
if ! docker ps -a --format "table {{.Names}}" 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
    log_warn "Container $CONTAINER_NAME not found (already stopped?)"
    exit 0
fi

# Stop the container
log_info "Stopping container $CONTAINER_NAME..."
docker stop "$CONTAINER_NAME" || log_error "Failed to stop container"

# Remove the container
log_info "Removing container $CONTAINER_NAME..."
docker rm "$CONTAINER_NAME" || log_error "Failed to remove container"

log_info "Container stopped and removed"
log_info "Volume $VOLUME_NAME persists (database preserved)"
echo ""
echo "To start again: ./scripts/start_mac.sh"
echo "To remove volume (delete database): docker volume rm $VOLUME_NAME"
