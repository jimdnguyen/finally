import { test, expect } from '@playwright/test';

test.describe('Trading', () => {
  test('buy shares updates portfolio', async ({ page }) => {
    await page.goto('/');

    // Wait for SSE connection (status dot green)
    const statusDot = page.locator('[data-testid="status-dot"]');
    await expect(statusDot).toHaveClass(/bg-green-up/, { timeout: 10000 });

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

    // Position appears in positions table
    await expect(page.locator('[data-testid="position-row"]:has-text("AAPL")')).toBeVisible();

    // Heatmap shows AAPL cell
    await expect(page.locator('[data-testid="heatmap-cell-AAPL"]')).toBeVisible();
  });
});
