import { test, expect } from '@playwright/test';

test.describe('AI Chat', () => {
  test('mock response renders with trade execution', async ({ page }) => {
    await page.goto('/');

    // Wait for app to initialize
    await page.waitForLoadState('networkidle');

    // Send a message
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('buy 1 AAPL');
    await chatInput.press('Enter');

    // Wait for mock response
    await page.waitForResponse(resp =>
      resp.url().includes('/api/chat') && resp.status() === 200
    );

    // Mock AI response appears in chat log (border-l-2 border-blue-primary indicates AI message)
    await expect(page.locator('.border-l-2.border-blue-primary').last()).toBeVisible();

    // Trade execution success line appears (text-green-up indicates success)
    await expect(page.locator('.text-green-up:has-text("OK")')).toBeVisible();
  });
});
