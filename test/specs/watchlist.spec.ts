import { test, expect } from '@playwright/test';

test.describe('Watchlist', () => {
  test('add and remove ticker', async ({ page }) => {
    await page.goto('/');

    // Wait for app to initialize
    await page.waitForLoadState('networkidle');

    // Count initial rows
    const initialCount = await page.locator('[data-testid="watchlist-row"]').count();

    // Add PYPL
    const addInput = page.locator('[data-testid="add-ticker-input"]');
    await addInput.fill('PYPL');
    await addInput.press('Enter');

    // Wait for row to appear
    await expect(page.locator('[data-testid="watchlist-row"]')).toHaveCount(initialCount + 1);
    const pyplRow = page.locator('[data-testid="watchlist-row"]:has-text("PYPL")');
    await expect(pyplRow).toBeVisible();

    // Remove it - use dispatchEvent since hover-revealed buttons don't work in headless
    await pyplRow.locator('[data-testid="remove-ticker"]').dispatchEvent('click');

    // Verify row disappears
    await expect(page.locator('[data-testid="watchlist-row"]')).toHaveCount(initialCount);
    await expect(page.locator('[data-testid="watchlist-row"]:has-text("PYPL")')).not.toBeVisible();
  });
});
