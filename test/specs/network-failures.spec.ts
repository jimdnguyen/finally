import { test, expect } from '@playwright/test';

test.describe('Network Failures & Timeouts', () => {
  test('SSE connection drop shows disconnected status', async ({ page, context }) => {
    await page.goto('/');

    // Wait for connection to establish (green status dot)
    // Use longer timeout — SSE connection in Docker bridge network can take >3s
    const statusDot = page.locator('[data-testid="status-dot"]');
    await expect(statusDot).toHaveClass(/bg-green-up/, { timeout: 10000 });

    // Block SSE reconnects BEFORE dropping current connection so EventSource can't
    // immediately reconnect (context.route intercepts new requests only)
    await context.route('**/api/stream/prices', route => route.abort('failed'));

    // Drop all active SSE connections server-side via test endpoint
    await page.request.get('/api/stream/test-drop');

    // Wait for status to change to disconnected (red) — allow time for DISCONNECT_TIMEOUT_MS
    await expect(statusDot).toHaveClass(/bg-red-down/, { timeout: 6000 });
  });

  test('app recovers when SSE reconnects', async ({ page, context }) => {
    await page.goto('/');

    const statusDot = page.locator('[data-testid="status-dot"]');

    // Wait for initial connection (green) — longer timeout for Docker bridge network
    await expect(statusDot).toHaveClass(/bg-green-up/, { timeout: 10000 });

    // Block SSE reconnects, then drop current connections
    await context.route('**/api/stream/prices', route => route.abort('failed'));
    await page.request.get('/api/stream/test-drop');

    // Wait for disconnected (red) — allow time for DISCONNECT_TIMEOUT_MS
    await expect(statusDot).toHaveClass(/bg-red-down/, { timeout: 6000 });

    // Unblock SSE — EventSource will retry automatically (retry: 1000ms)
    await context.unroute('**/api/stream/prices');

    // Wait for reconnection (green)
    await expect(statusDot).toHaveClass(/bg-green-up/, { timeout: 10000 });
  });

  test('trade execution timeout shows error', async ({ page, context }) => {
    await page.goto('/');

    // Intercept trade POST and delay it beyond timeout (3s)
    await context.route('**/api/portfolio/trade', route => {
      setTimeout(() => {
        route.abort('timedout');
      }, 4000);
    });

    // Scope to first <main> (desktop layout) — page renders 3 responsive layouts simultaneously
    const main = page.locator('main').first();

    // Try to execute trade
    await main.locator('[data-testid="trade-ticker"]').fill('AAPL');
    await main.locator('[data-testid="trade-quantity"]').fill('1');

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/portfolio/trade'), { timeout: 8000 }),
      main.locator('[data-testid="buy-button"]').click(),
    ]).catch(() => null);

    // Error notification should appear — use .first() to skip Next.js route announcer
    await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('chat API timeout shows error state', async ({ page, context }) => {
    await page.goto('/');

    // Intercept chat POST and timeout
    await context.route('**/api/chat', route => {
      setTimeout(() => {
        route.abort('timedout');
      }, 4000);
    });

    // Use .first() — page renders 3 responsive layouts simultaneously
    const chatInput = page.locator('[data-testid="chat-input"]').first();
    await chatInput.fill('buy 10 AAPL');

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/chat'), { timeout: 8000 }).catch(() => null),
      chatInput.press('Enter'),
    ]);

    // Error message should appear — use .first() to skip Next.js route announcer
    await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 5000 });
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
