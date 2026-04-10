# FinAlly E2E Tests

End-to-end tests for the FinAlly trading platform using Playwright.

## Setup

```bash
npm install
npx playwright install chromium
```

## Running Tests

### Headless mode (CI/CD)
```bash
npm test
```

### Headed mode (interactive, see the browser)
```bash
npm run test:headed
```

## Test Coverage

- **fresh-start.spec.ts** — Page loads, default watchlist visible, prices streaming
- **watchlist.spec.ts** — Add/remove tickers
- **trading.spec.ts** — Buy and sell shares, position tracking
- **portfolio.spec.ts** — Portfolio heatmap and P&L chart rendering
- **chat.spec.ts** — AI chat messaging (mock mode)
- **connection.spec.ts** — SSE connection and status indicator

## Environment

Tests run with `LLM_MOCK=true` by default (via playwright.config.ts) for deterministic AI responses.

The `webServer` config in `playwright.config.ts` automatically starts the backend FastAPI server before running tests, so no manual setup is needed.

## Notes

- Timeout: 30s per test
- Retries: 1 attempt on failure
- Browser: Chromium
- Base URL: http://localhost:8000
