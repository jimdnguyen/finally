import { test, expect } from '@playwright/test';

test.describe('Fresh Start', () => {
  test('loads with default state', async ({ page }) => {
    await page.goto('/');

    // Wait for app to initialize — watchlist rows confirm data loaded
    const watchlistRows = page.locator('[data-testid="watchlist-row"]');
    await expect(watchlistRows.first()).toBeVisible();

    // 10 default tickers visible
    await expect(watchlistRows).toHaveCount(10);

    // Cash balance is shown (don't assert exact value — shared DB across browser projects)
    const cashBalance = page.locator('[data-testid="cash-balance"]');
    await expect(cashBalance).toBeVisible();
    await expect(cashBalance).toContainText('$');

    // StatusDot exists (SSE connection status indicator)
    const statusDot = page.locator('[data-testid="status-dot"]');
    await expect(statusDot).toBeVisible();

    // Main chart renders (canvas exists)
    await expect(page.locator('canvas').first()).toBeVisible();
  });
});
