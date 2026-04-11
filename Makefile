.DEFAULT_GOAL := help
.PHONY: start stop restart build test logs clean help

IMAGE     := finally
CONTAINER := finally-app
VOLUME    := finally-data
PORT      := 8000

# ── targets ────────────────────────────────────────────────────────────────────

start: .env  ## Start the app (builds image if missing)
	@docker volume create $(VOLUME) 2>/dev/null || true
	@if docker ps --format '{{.Names}}' | grep -q '^$(CONTAINER)$$'; then \
	  echo "[INFO] Already running → http://localhost:$(PORT)"; exit 0; \
	fi
	@docker rm $(CONTAINER) 2>/dev/null || true
	@if ! docker image inspect $(IMAGE) > /dev/null 2>&1; then \
	  echo "[INFO] Image not found — building..."; \
	  docker build -t $(IMAGE) . || exit 1; \
	fi
	docker run --name $(CONTAINER) -p $(PORT):8000 \
	  -v $(VOLUME):/app/db --env-file .env -d $(IMAGE)
	@echo "[INFO] Waiting for app to be ready (up to 30s)..."
	@for i in $$(seq 30); do \
	  if docker exec $(CONTAINER) curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then \
	    echo "[INFO] Ready → http://localhost:$(PORT)"; exit 0; \
	  fi; \
	  sleep 1; \
	done; \
	echo "[ERROR] App failed health check — run 'make logs' to debug"; exit 1

stop:  ## Stop and remove the container (data volume preserved)
	@docker stop $(CONTAINER) 2>/dev/null || true
	@docker rm   $(CONTAINER) 2>/dev/null || true
	@echo "[INFO] Stopped. Data volume '$(VOLUME)' preserved."

restart: stop start  ## Restart the container

build:  ## Force rebuild the Docker image
	docker build -t $(IMAGE) .

test:  ## Run E2E Playwright tests
	docker compose -f test/docker-compose.test.yml run --rm playwright

logs:  ## Tail container logs
	docker logs -f $(CONTAINER)

clean: stop  ## Remove container AND data volume (destructive — loses trades/portfolio)
	@docker volume rm $(VOLUME) 2>/dev/null || true
	@echo "[INFO] Volume removed. Fresh \$$10k start next run."

.env:
	@echo "[ERROR] .env not found. Run: cp .env.example .env  then add OPENROUTER_API_KEY"
	@exit 1

help:  ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'
