import { test, expect } from '@playwright/test';

test.describe('Trading', () => {
  test('buy shares updates portfolio', async ({ page }) => {
    await page.goto('/');

    // Wait for cash balance to show a real value (not empty during initial render)
    const cashLocator = page.locator('[data-testid="cash-balance"]');
    await expect(cashLocator).toContainText('$');

    const cashText = await cashLocator.textContent();
    const initialCash = parseFloat(cashText?.replace(/[$,]/g, '') ?? '0');

    // Buy 5 AAPL
    await page.fill('[data-testid="trade-ticker"]', 'AAPL');
    await page.fill('[data-testid="trade-quantity"]', '5');

    // Start waiting before click to avoid missing fast responses
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/portfolio/trade')),
      page.click('[data-testid="buy-button"]'),
    ]);

    expect(response.status()).toBe(200);

    // Wait for cash to update in the UI (Playwright auto-retries)
    await expect(cashLocator).not.toContainText(cashText!);
    const newCashText = await cashLocator.textContent();
    const newCash = parseFloat(newCashText?.replace(/[$,]/g, '') ?? '0');
    expect(newCash).toBeLessThan(initialCash);

    // Position appears in positions table
    await expect(page.locator('[data-testid="position-row"]:has-text("AAPL")')).toBeVisible();

    // Switch to Heatmap tab and verify AAPL cell
    await page.click('text=Heatmap');
    await expect(page.locator('[data-testid="heatmap-cell-AAPL"]')).toBeVisible({ timeout: 10000 });
  });
});
