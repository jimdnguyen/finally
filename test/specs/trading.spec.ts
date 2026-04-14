import { test, expect } from '@playwright/test';

test.describe('Trading', () => {
  test('buy shares updates portfolio', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load (API calls complete)
    await page.waitForLoadState('networkidle');

    // Get initial cash
    const cashLocator = page.locator('[data-testid="cash-balance"]');
    const cashText = await cashLocator.textContent();
    const initialCash = parseFloat(cashText?.replace(/[$,]/g, '') ?? '0');

    // Buy 5 AAPL
    await page.fill('[data-testid="trade-ticker"]', 'AAPL');
    await page.fill('[data-testid="trade-quantity"]', '5');
    await page.click('[data-testid="buy-button"]');

    // Wait for trade to complete
    await page.waitForResponse(resp =>
      resp.url().includes('/api/portfolio/trade') && resp.status() === 200
    );

    // Cash decreased
    const newCashText = await cashLocator.textContent();
    const newCash = parseFloat(newCashText?.replace(/[$,]/g, '') ?? '0');
    expect(newCash).toBeLessThan(initialCash);

    // Position appears in positions table (default tab is Positions)
    await expect(page.locator('[data-testid="position-row"]:has-text("AAPL")')).toBeVisible();

    // Switch to Heatmap tab and verify AAPL cell (AC4 requirement)
    await page.click('text=Heatmap');
    await expect(page.locator('[data-testid="heatmap-cell-AAPL"]')).toBeVisible({ timeout: 10000 });
  });
});
