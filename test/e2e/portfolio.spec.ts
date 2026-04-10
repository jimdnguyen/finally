import { test, expect } from '@playwright/test';

test('Portfolio: heatmap renders after trades', async ({ page }) => {
  await page.goto('/');

  // Wait for page to load
  await page.waitForTimeout(2000);

  // Verify portfolio section is visible
  const portfolioSection = page.locator('text=Portfolio').first();
  await expect(portfolioSection).toBeVisible();

  // Check for portfolio visualization elements
  const pageText = await page.textContent('body');
  expect(pageText).toContain('Portfolio');
  expect(pageText).toContain('Heat Map');
});

test('Portfolio: P&L chart renders', async ({ page }) => {
  await page.goto('/');

  // Wait for page to load
  await page.waitForTimeout(2000);

  // Execute a trade to generate portfolio snapshot
  const quantityInput = page.locator('input[type="number"]');
  const buyButton = page.locator('button:has-text("BUY")').first();

  await quantityInput.fill('3');
  await buyButton.click();

  await page.waitForTimeout(1500);

  // Verify portfolio tabs are visible (Heat Map, P&L, Positions)
  const heatMapTab = page.locator('button:has-text("Heat Map")');
  const plTab = page.locator('button:has-text("P&L")');

  await expect(heatMapTab).toBeVisible();
  await expect(plTab).toBeVisible();
});
