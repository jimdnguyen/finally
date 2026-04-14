import { test, expect } from '@playwright/test';

test.describe('Fresh Start', () => {
  test('loads with default state', async ({ page }) => {
    await page.goto('/');

    // Wait for app to initialize
    await page.waitForLoadState('networkidle');

    // 10 default tickers visible
    const watchlistRows = page.locator('[data-testid="watchlist-row"]');
    await expect(watchlistRows).toHaveCount(10);

    // $10,000.00 cash shown (in header)
    const cashBalance = page.locator('[data-testid="cash-balance"]');
    await expect(cashBalance).toContainText('$10,000.00');

    // StatusDot exists (SSE connection status indicator)
    // Note: In headless Firefox, SSE may not connect reliably; we verify the component renders
    const statusDot = page.locator('[data-testid="status-dot"]');
    await expect(statusDot).toBeVisible();

    // Main chart renders (canvas exists)
    await expect(page.locator('canvas').first()).toBeVisible();
  });
});
