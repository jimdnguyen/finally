import { test, expect } from '@playwright/test';

test.describe('Trading', () => {
  // Reset DB to seed state before each test so cash balance starts at $10,000
  // (ai-chat tests execute trades via LLM mock, depleting cash across test runs)
  test.beforeEach(async ({ request }) => {
    await request.get('/api/stream/test-reset');
  });

  test('buy shares updates portfolio', async ({ page }) => {
    await page.goto('/');

    // Wait for cash balance to show a real value (not empty during initial render)
    const cashLocator = page.locator('[data-testid="cash-balance"]');
    await expect(cashLocator).toContainText('$');

    const cashText = await cashLocator.textContent();
    const initialCash = parseFloat(cashText?.replace(/[$,]/g, '') ?? '0');

    // Scope to first <main> (desktop layout) — page renders 3 responsive layouts simultaneously
    const main = page.locator('main').first();

    // Buy 5 AAPL
    await main.locator('[data-testid="trade-ticker"]').fill('AAPL');
    await main.locator('[data-testid="trade-quantity"]').fill('5');

    // Start waiting before click to avoid missing fast responses
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/portfolio/trade')),
      main.locator('[data-testid="buy-button"]').click(),
    ]);

    expect(response.status()).toBe(200);

    // Wait for cash to update in the UI (Playwright auto-retries)
    await expect(cashLocator).not.toContainText(cashText!);
    const newCashText = await cashLocator.textContent();
    const newCash = parseFloat(newCashText?.replace(/[$,]/g, '') ?? '0');
    expect(newCash).toBeLessThan(initialCash);

    // Position appears in positions table
    await expect(main.locator('[data-testid="position-row"]:has-text("AAPL")')).toBeVisible();

    // Switch to Heatmap tab and verify AAPL cell
    await page.click('text=Heatmap');
    await expect(page.locator('[data-testid="heatmap-cell-AAPL"]')).toBeVisible({ timeout: 10000 });
  });
});
