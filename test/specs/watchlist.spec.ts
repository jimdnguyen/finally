import { test, expect } from '@playwright/test';

test.describe('Watchlist', () => {
  test('add and remove ticker', async ({ page }) => {
    await page.goto('/');

    // Scope to first <main> (desktop layout) — page renders 3 responsive layouts simultaneously
    const panel = page.locator('main').first();

    // Wait for app to initialize — watchlist rows confirm data loaded
    const rows = panel.locator('[data-testid="watchlist-row"]');
    await expect(rows.first()).toBeVisible();
    const initialCount = await rows.count();

    // Add PYPL
    const addInput = panel.locator('[data-testid="add-ticker-input"]');
    await addInput.fill('PYPL');
    await addInput.press('Enter');

    // Wait for row to appear
    await expect(rows).toHaveCount(initialCount + 1);
    const pyplRow = panel.locator('[data-testid="watchlist-row"]:has-text("PYPL")');
    await expect(pyplRow).toBeVisible();

    // Remove it - use dispatchEvent since hover-revealed buttons don't work in headless
    await pyplRow.locator('[data-testid="remove-ticker"]').dispatchEvent('click');

    // Verify row disappears
    await expect(rows).toHaveCount(initialCount);
    await expect(panel.locator('[data-testid="watchlist-row"]:has-text("PYPL")')).not.toBeVisible();
  });
});
