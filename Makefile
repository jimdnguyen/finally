.PHONY: start stop build logs test test-firefox test-chromium test-all clean

IMAGE_NAME := finally
CONTAINER_NAME := finally
VOLUME_NAME := finally-data

start:
	@docker stop $(CONTAINER_NAME) 2>/dev/null || true
	@docker rm $(CONTAINER_NAME) 2>/dev/null || true
	@docker images -q $(IMAGE_NAME) | grep -q . || docker build -t $(IMAGE_NAME) .
	docker run -d --name $(CONTAINER_NAME) \
		-v $(VOLUME_NAME):/app/db \
		-p 8000:8000 \
		--env-file .env \
		$(IMAGE_NAME)
	@echo "App running at http://localhost:8000"

stop:
	docker stop $(CONTAINER_NAME) || true
	docker rm $(CONTAINER_NAME) || true

build:
	docker build --no-cache -t $(IMAGE_NAME) .

logs:
	docker logs -f $(CONTAINER_NAME)

test:
	docker-compose -f test/docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
	docker-compose -f test/docker-compose.test.yml up --build --force-recreate --abort-on-container-exit --exit-code-from playwright

test-firefox:
	docker-compose -f test/docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
	PLAYWRIGHT_PROJECT=firefox docker-compose -f test/docker-compose.test.yml up --build --force-recreate --abort-on-container-exit --exit-code-from playwright

test-chromium:
	docker-compose -f test/docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
	PLAYWRIGHT_PROJECT=chromium docker-compose -f test/docker-compose.test.yml up --build --force-recreate --abort-on-container-exit --exit-code-from playwright

test-all:
	$(MAKE) test-firefox
	$(MAKE) test-chromium

clean:
	@echo "WARNING: This will delete all portfolio data!"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	docker volume rm $(VOLUME_NAME) || true
