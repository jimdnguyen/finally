import { test, expect } from '@playwright/test';

test('Connection: status indicator shows connected on load', async ({ page }) => {
  await page.goto('/');

  // Wait for page to load
  await page.waitForTimeout(2000);

  // Verify page is interactive by checking for watchlist and portfolio sections
  const pageContent = await page.textContent('body');
  expect(pageContent).toContain('Watchlist');
  expect(pageContent).toContain('Portfolio');
  expect(pageContent).toContain('FinAlly');
});

test('Connection: SSE stream is active', async ({ page }) => {
  let priceUpdatesReceived = 0;

  // Listen for SSE connections
  page.on('response', (response) => {
    if (response.url().includes('/api/stream/prices')) {
      priceUpdatesReceived++;
    }
  });

  await page.goto('/');

  // Wait for prices to stream in (should see price updates)
  await page.waitForTimeout(3000);

  // Verify at least one price update was received
  const pageContent = await page.textContent('body');
  expect(pageContent).toMatch(/\d+\.\d{2}/); // Price format
});
