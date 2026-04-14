# Story 4.3: Playwright E2E Tests

## Status: in-progress

## Story

As a developer ensuring the app works end-to-end,
I want Playwright tests covering critical user flows,
so that regressions are caught before deployment.

## Acceptance Criteria

- **AC1** — Given `test/docker-compose.test.yml` exists, when it runs, then it starts the app container (with `LLM_MOCK=true`) and a Playwright container, with the test container able to reach the app at `http://app:8000`.
- **AC2** — Given the E2E suite runs, when the fresh-start test executes, then it verifies: 10 default tickers visible, `$10,000.00` cash shown, at least one price update received (StatusDot green), and the main chart renders.
- **AC3** — Given the watchlist tests run, when add-ticker flow executes, then typing a valid ticker (e.g., "PYPL") and pressing Enter adds a row; clicking the `×` on that row removes it.
- **AC4** — Given the trading tests run, when a buy order is submitted (e.g., 5 shares of AAPL), then cash decreases by approximately `5 × current_price`, a position row appears in the positions table, and the heatmap shows an AAPL cell.
- **AC5** — Given the AI chat test runs with `LLM_MOCK=true`, when a message is sent, then the mock response appears in the chat log, and any mock trade execution appears as a `.log-exec-ok` line.
- **AC6** — Given `make test` runs, when all specs pass, then the exit code is 0; on failure, Playwright screenshots are saved to `test/screenshots/`.

---

## Dev Notes

### Architecture Reference (ARCH-20)

Playwright E2E infrastructure in `test/docker-compose.test.yml`; E2E specs in `test/specs/`; run with `LLM_MOCK=true`.

### docker-compose.test.yml Structure

```yaml
version: "3.8"

services:
  app:
    build:
      context: ..
      dockerfile: Dockerfile
    environment:
      - LLM_MOCK=true
      - DATABASE_PATH=/app/db/finally.db
    # No volume mount — fresh database each run for test isolation
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 5s
      timeout: 3s
      retries: 10
    networks:
      - test-network

  playwright:
    image: mcr.microsoft.com/playwright:v1.52.0-noble
    working_dir: /tests
    volumes:
      - ./specs:/tests/specs
      - ./screenshots:/tests/screenshots
      - ./playwright.config.ts:/tests/playwright.config.ts
      - ./package.json:/tests/package.json
    command: npx playwright test
    depends_on:
      app:
        condition: service_healthy
    environment:
      - BASE_URL=http://app:8000
    networks:
      - test-network

networks:
  test-network:
    driver: bridge
```

**Key decisions:**
- App service has no volume — fresh SQLite DB each test run for isolation
- `LLM_MOCK=true` ensures deterministic AI responses
- Health check ensures app is ready before Playwright starts
- Screenshots volume mount for failure artifacts

### Playwright Configuration

`test/playwright.config.ts`:
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8000',
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: './screenshots',
});
```

### Test Spec Files

**test/specs/fresh-start.spec.ts** — AC2
```typescript
import { test, expect } from '@playwright/test';

test.describe('Fresh Start', () => {
  test('loads with default state', async ({ page }) => {
    await page.goto('/');
    
    // 10 default tickers visible
    const watchlistRows = page.locator('[data-testid="watchlist-row"]');
    await expect(watchlistRows).toHaveCount(10);
    
    // $10,000.00 cash shown (in header)
    await expect(page.locator('text=$10,000.00')).toBeVisible();
    
    // StatusDot turns green (SSE connected)
    await expect(page.locator('[data-testid="status-dot"]')).toHaveCSS(
      'background-color',
      'rgb(63, 185, 80)' // green-up
    );
    
    // Main chart renders (canvas exists)
    await expect(page.locator('canvas')).toBeVisible();
  });
});
```

**test/specs/watchlist.spec.ts** — AC3
```typescript
import { test, expect } from '@playwright/test';

test.describe('Watchlist', () => {
  test('add and remove ticker', async ({ page }) => {
    await page.goto('/');
    
    // Add PYPL
    const addInput = page.locator('[data-testid="add-ticker-input"]');
    await addInput.fill('PYPL');
    await addInput.press('Enter');
    
    // Verify row appears
    await expect(page.locator('text=PYPL')).toBeVisible();
    
    // Remove it
    const pyplRow = page.locator('[data-testid="watchlist-row"]:has-text("PYPL")');
    await pyplRow.hover();
    await pyplRow.locator('[data-testid="remove-ticker"]').click();
    
    // Verify row disappears
    await expect(page.locator('text=PYPL')).not.toBeVisible();
  });
});
```

**test/specs/trading.spec.ts** — AC4
```typescript
import { test, expect } from '@playwright/test';

test.describe('Trading', () => {
  test('buy shares updates portfolio', async ({ page }) => {
    await page.goto('/');
    
    // Wait for prices to load
    await expect(page.locator('[data-testid="status-dot"]')).toHaveCSS(
      'background-color',
      'rgb(63, 185, 80)'
    );
    
    // Get initial cash
    const cashText = await page.locator('[data-testid="cash-balance"]').textContent();
    const initialCash = parseFloat(cashText.replace(/[$,]/g, ''));
    
    // Buy 5 AAPL
    await page.fill('[data-testid="trade-ticker"]', 'AAPL');
    await page.fill('[data-testid="trade-quantity"]', '5');
    await page.click('[data-testid="buy-button"]');
    
    // Wait for trade to complete
    await page.waitForResponse(resp => 
      resp.url().includes('/api/portfolio/trade') && resp.status() === 200
    );
    
    // Cash decreased
    const newCashText = await page.locator('[data-testid="cash-balance"]').textContent();
    const newCash = parseFloat(newCashText.replace(/[$,]/g, ''));
    expect(newCash).toBeLessThan(initialCash);
    
    // Position appears in table (switch to Positions tab first)
    await page.click('text=Positions');
    await expect(page.locator('[data-testid="position-row"]:has-text("AAPL")')).toBeVisible();
    
    // Heatmap shows AAPL cell (switch to Heatmap tab)
    await page.click('text=Heatmap');
    await expect(page.locator('[data-testid="heatmap-cell"]:has-text("AAPL")')).toBeVisible();
  });
});
```

**test/specs/ai-chat.spec.ts** — AC5
```typescript
import { test, expect } from '@playwright/test';

test.describe('AI Chat', () => {
  test('mock response renders with trade execution', async ({ page }) => {
    await page.goto('/');
    
    // Send a message
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('buy 1 AAPL');
    await chatInput.press('Enter');
    
    // Wait for mock response
    await page.waitForResponse(resp => 
      resp.url().includes('/api/chat') && resp.status() === 200
    );
    
    // Mock response appears in chat log
    await expect(page.locator('.log-ai')).toBeVisible();
    
    // Trade execution line appears (mock includes a trade)
    await expect(page.locator('.log-exec-ok')).toBeVisible();
  });
});
```

### Package.json for Test Container

`test/package.json`:
```json
{
  "name": "finally-e2e",
  "private": true,
  "devDependencies": {
    "@playwright/test": "^1.52.0"
  }
}
```

### Data-testid Requirements

The E2E tests rely on `data-testid` attributes. Verify these exist in the frontend components:

| Component | Required data-testid |
|-----------|---------------------|
| WatchlistRow | `watchlist-row` |
| StatusDot | `status-dot` |
| AddTickerInput | `add-ticker-input` |
| RemoveTickerButton | `remove-ticker` |
| TradeBar ticker | `trade-ticker` |
| TradeBar quantity | `trade-quantity` |
| BuyButton | `buy-button` |
| SellButton | `sell-button` |
| CashBalance | `cash-balance` |
| PositionRow | `position-row` |
| HeatmapCell | `heatmap-cell` |
| ChatInput | `chat-input` |

### make test Integration (AC6)

The existing Makefile already has:
```makefile
test:
	docker-compose -f test/docker-compose.test.yml up --abort-on-container-exit --exit-code-from playwright
```

- `--abort-on-container-exit` — stops all services when playwright exits
- `--exit-code-from playwright` — returns playwright's exit code to the shell
- Exit 0 = all tests passed, non-zero = failures

### Mock LLM Response (Story 3.3)

The mock response from `backend/app/chat/service.py` when `LLM_MOCK=true`:
```python
ChatResponse(
    message="Mock AI response for testing",
    trades=[TradeResult(ticker="AAPL", side="buy", quantity=1, ...)],
    watchlist_changes=[]
)
```

This ensures AC5 can verify both the message and `.log-exec-ok` line.

### Screenshot Output

On test failure, Playwright saves screenshots to `test/screenshots/`. The Makefile already references this path. Add to `.gitignore`:
```
test/screenshots/
test/test-results/
```

### Prior Story Context

From Story 4.2:
- `make test` target exists and calls docker-compose
- Port 8000 is used by the app

From Story 3.3:
- `LLM_MOCK=true` returns deterministic mock responses
- Mock includes a sample buy trade for AAPL

---

## Tasks / Subtasks

- [x] Task 1 — Create test infrastructure (AC1, AC6)
  - [x] 1.1 Create `test/docker-compose.test.yml` with app + playwright services
  - [x] 1.2 Create `test/playwright.config.ts` with correct settings
  - [x] 1.3 Create `test/package.json` with playwright dependency
  - [x] 1.4 Update `.gitignore` to exclude `test/screenshots/` and `test/test-results/`
  - [ ] 1.5 Verify `make test` builds and runs the compose file

- [x] Task 2 — Add data-testid attributes to frontend components
  - [x] 2.1 Add `data-testid="watchlist-row"` to WatchlistRow
  - [x] 2.2 Add `data-testid="status-dot"` to StatusDot
  - [x] 2.3 Add `data-testid="add-ticker-input"` to add ticker input
  - [x] 2.4 Add `data-testid="remove-ticker"` to remove button
  - [x] 2.5 Add `data-testid="trade-ticker"`, `trade-quantity`, `buy-button`, `sell-button` to TradeBar
  - [x] 2.6 Add `data-testid="cash-balance"` to cash display in Header
  - [x] 2.7 Add `data-testid="position-row"` to PositionsTable rows
  - [x] 2.8 Add `data-testid="heatmap-cell"` to PortfolioHeatmap cells
  - [x] 2.9 Add `data-testid="chat-input"` to chat input field

- [x] Task 3 — Implement fresh-start test (AC2)
  - [x] 3.1 Create `test/specs/fresh-start.spec.ts`
  - [x] 3.2 Test: 10 default tickers visible
  - [x] 3.3 Test: $10,000.00 cash shown
  - [x] 3.4 Test: StatusDot green (SSE connected)
  - [x] 3.5 Test: Main chart canvas renders

- [x] Task 4 — Implement watchlist tests (AC3)
  - [x] 4.1 Create `test/specs/watchlist.spec.ts`
  - [x] 4.2 Test: Add ticker via input + Enter
  - [x] 4.3 Test: Remove ticker via hover + click X

- [x] Task 5 — Implement trading tests (AC4)
  - [x] 5.1 Create `test/specs/trading.spec.ts`
  - [x] 5.2 Test: Buy 5 AAPL
  - [x] 5.3 Test: Cash decreases after trade
  - [x] 5.4 Test: Position appears in table
  - [x] 5.5 Test: Heatmap cell appears

- [x] Task 6 — Implement AI chat test (AC5)
  - [x] 6.1 Create `test/specs/ai-chat.spec.ts`
  - [x] 6.2 Test: Send message, mock response appears
  - [x] 6.3 Test: `.log-exec-ok` line visible

- [ ] Task 7 — Final verification (AC6)
  - [ ] 7.1 Run full `make test` — all specs pass, exit code 0
  - [ ] 7.2 Intentionally break a test — verify screenshot saved
  - [ ] 7.3 Document any notes in Dev Agent Record

---

## Dev Agent Record

### Agent Model Used

(To be filled during implementation)

### Debug Log References

(To be filled if debugging is needed)

### Completion Notes List

(To be filled during implementation)

### File List

| File | Change |
|------|--------|
| `test/docker-compose.test.yml` | Created |
| `test/playwright.config.ts` | Created |
| `test/package.json` | Created |
| `test/specs/fresh-start.spec.ts` | Created |
| `test/specs/watchlist.spec.ts` | Created |
| `test/specs/trading.spec.ts` | Created |
| `test/specs/ai-chat.spec.ts` | Created |
| `.gitignore` | Updated — added test artifacts |
| `frontend/src/components/*` | Updated — added data-testid attributes |

### Review Findings

- [x] [Review][Patch] Healthcheck verifies DB connectivity [backend/app/health/router.py] ✓ fixed
- [x] [Review][Defer] Floating-point rounding in trade quantities [backend/app/portfolio/service.py] — deferred, pre-existing
- [x] [Review][Defer] LLM malformed JSON causes 500 instead of 503 [backend/app/chat/service.py] — deferred, pre-existing
- [x] [Review][Defer] Partial DB seeding on disk-full [backend/app/db/init.py] — deferred, pre-existing
- [x] [Review][Defer] SSE sends empty data if market init fails [backend/app/market/stream.py] — deferred, pre-existing
