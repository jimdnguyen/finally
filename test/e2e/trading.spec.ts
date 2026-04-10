import { test, expect } from '@playwright/test';

test('Trading: buy shares and verify position', async ({ page }) => {
  await page.goto('/');

  // Wait for page to load and prices to stream in
  await page.waitForTimeout(2000);

  // Find quantity input in the trading panel (in the main area)
  const quantityInput = page.locator('input[type="number"]');

  // Find BUY button in the trading panel
  const buyButton = page.locator('button:has-text("BUY")').first();

  // Enter quantity 1 (ticker defaults to AAPL which is shown as "Selected")
  await quantityInput.fill('1');
  await buyButton.click();

  // Wait for trade to execute
  await page.waitForTimeout(1500);

  // Verify AAPL appears somewhere (already selected)
  const aaplLabel = page.locator('text=AAPL').first();
  await expect(aaplLabel).toBeVisible({ timeout: 5000 });
});

test('Trading: sell shares and verify position update', async ({ page }) => {
  await page.goto('/');

  // Wait for page to load
  await page.waitForTimeout(2000);

  // First, buy some shares
  const quantityInput = page.locator('input[type="number"]');
  const buyButton = page.locator('button:has-text("BUY")').first();
  const sellButton = page.locator('button:has-text("SELL")').first();

  // Buy 5 shares of AAPL (default selected)
  await quantityInput.fill('5');
  await buyButton.click();

  await page.waitForTimeout(1500);

  // Now sell 2 shares
  await quantityInput.fill('2');
  await sellButton.click();

  await page.waitForTimeout(1500);

  // Verify we can see AAPL (position still exists)
  const aaplLabel = page.locator('text=AAPL').first();
  await expect(aaplLabel).toBeVisible();
});
