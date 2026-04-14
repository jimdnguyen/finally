.PHONY: start stop build logs test test-firefox test-chromium test-all clean

start:
	docker-compose up -d --build
	@echo "App running at http://localhost:8000"

stop:
	docker-compose down

build:
	docker-compose build --no-cache

logs:
	docker-compose logs -f

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
	docker-compose down --volumes 2>/dev/null || true
