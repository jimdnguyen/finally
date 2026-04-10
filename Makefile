IMAGE  := finally-app
CONTAINER := finally-app
VOLUME := finally-data
PORT   := 8000

.PHONY: build run start stop restart logs test dev clean

## Build the Docker image
build:
	docker build -t $(IMAGE) .

## Start container (build first if image missing)
run: _ensure_image
	-docker rm -f $(CONTAINER) 2>/dev/null || true
	docker run -d \
		--name $(CONTAINER) \
		-p $(PORT):$(PORT) \
		-v $(VOLUME):/app/db \
		--env-file .env \
		$(IMAGE)
	@echo "FinAlly running → http://localhost:$(PORT)"

## Alias: build then run
start: build run

## Stop and remove container (data volume preserved)
stop:
	docker rm -f $(CONTAINER) 2>/dev/null && echo "Stopped." || echo "Not running."

## Restart container
restart: stop run

## Tail container logs
logs:
	docker logs -f $(CONTAINER)

## Run E2E Playwright tests
test:
	cd test && npx playwright test

## Run backend locally without Docker (dev mode)
dev:
	cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port $(PORT) --reload

## Run backend unit tests
test-unit:
	cd backend && uv run --extra dev pytest -v

## Delete container + image (keeps data volume)
clean: stop
	-docker rmi $(IMAGE) 2>/dev/null || true

_ensure_image:
	@docker image inspect $(IMAGE) >/dev/null 2>&1 || $(MAKE) build
