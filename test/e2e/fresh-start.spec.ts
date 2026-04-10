import { test, expect } from '@playwright/test';

test('Fresh start: page loads with watchlist and balance', async ({ page }) => {
  // Navigate to homepage
  await page.goto('/');

  // Verify page title
  const title = await page.title();
  expect(title).toContain('FinAlly');

  // Wait for page to fully load (including price data)
  await page.waitForTimeout(3000);

  // Get page content
  const pageText = await page.textContent('body');
  expect(pageText).toBeTruthy();

  // Verify key elements are present on the page
  expect(pageText).toContain('FinAlly'); // Title
  expect(pageText).toContain('Watchlist'); // Watchlist section
  expect(pageText).toContain('Portfolio'); // Portfolio section
  expect(pageText).toContain('AI Assistant'); // Chat section

  // Verify AAPL is visible (default selected ticker)
  expect(pageText).toContain('AAPL');
});
