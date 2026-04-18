import { test, expect } from '@playwright/test';

test.describe('Network Failures & Timeouts', () => {
  test('SSE connection drop shows disconnected status', async ({ page, context }) => {
    await page.goto('/');

    // Wait for connection to establish (green status dot)
    const statusDot = page.locator('[data-testid="status-dot"]');
    await expect(statusDot).toHaveClass(/bg-green-up/, { timeout: 3000 });

    // Abort all network requests to simulate connection drop
    await context.route('**/*', route => {
      route.abort('failed');
    });

    // Wait for status to change to disconnected (red)
    await expect(statusDot).toHaveClass(/bg-red-down/, { timeout: 3000 });
  });

  test('app recovers when SSE reconnects', async ({ page, context }) => {
    await page.goto('/');

    const statusDot = page.locator('[data-testid="status-dot"]');

    // Wait for initial connection (green)
    await expect(statusDot).toHaveClass(/bg-green-up/, { timeout: 3000 });

    // Abort network
    await context.route('**/*', route => {
      route.abort('failed');
    });

    // Wait for disconnected (red)
    await expect(statusDot).toHaveClass(/bg-red-down/, { timeout: 3000 });

    // Allow network again
    await context.unroute('**/*');

    // Wait for reconnection (green)
    await expect(statusDot).toHaveClass(/bg-green-up/, { timeout: 5000 });
  });

  test('trade execution timeout shows error', async ({ page, context }) => {
    await page.goto('/');

    // Intercept trade POST and delay it beyond timeout (3s)
    await context.route('**/api/portfolio/trade', route => {
      setTimeout(() => {
        route.abort('timedout');
      }, 4000);
    });

    // Try to execute trade
    await page.locator('[data-testid="trade-ticker"]').fill('AAPL');
    await page.locator('[data-testid="trade-quantity"]').fill('1');

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/portfolio/trade'), { timeout: 8000 }),
      page.locator('[data-testid="buy-button"]').click(),
    ]).catch(() => null);

    // Error notification should appear
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
  });

  test('chat API timeout shows error state', async ({ page, context }) => {
    await page.goto('/');

    // Intercept chat POST and timeout
    await context.route('**/api/chat', route => {
      setTimeout(() => {
        route.abort('timedout');
      }, 4000);
    });

    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('buy 10 AAPL');

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/chat'), { timeout: 8000 }).catch(() => null),
      chatInput.press('Enter'),
    ]);

    // Error message should appear
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
  });

  test('portfolio data updates resume after network recovery', async ({ page, context }) => {
    await page.goto('/');

    // Get initial cash balance
    const cashElement = page.locator('[data-testid="cash-balance"]');
    await expect(cashElement).toBeVisible();
    await cashElement.textContent();

    // Simulate network outage
    await context.route('**/*', route => {
      route.abort('failed');
    });

    // Wait a bit
    await page.waitForTimeout(1000);

    // Restore network
    await context.unroute('**/*');

    // Portfolio data should be accessible again (no stale data error)
    await expect(cashElement).toBeVisible({ timeout: 3000 });
    const recoveredCash = await cashElement.textContent();
    expect(recoveredCash).not.toBeNull();
  });
});
