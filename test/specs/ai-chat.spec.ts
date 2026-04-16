import { test, expect } from '@playwright/test';

test.describe('AI Chat', () => {
  test('mock response renders with trade execution', async ({ page }) => {
    await page.goto('/');

    // Wait for app to initialize — chat input confirms UI is ready
    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible();

    // Start waiting before action to avoid missing fast mock responses
    await chatInput.fill('buy 1 AAPL');
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/chat') && resp.status() === 200),
      chatInput.press('Enter'),
    ]);

    expect(response.status()).toBe(200);

    // Mock AI response appears in chat log (border-l-2 border-blue-primary indicates AI message)
    await expect(page.locator('.border-l-2.border-blue-primary').last()).toBeVisible();

    // Trade execution success line appears (text-green-up indicates success)
    await expect(page.locator('.text-green-up:has-text("OK")')).toBeVisible();
  });
});
