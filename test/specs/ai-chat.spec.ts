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

  test('empty message is not sent', async ({ page }) => {
    await page.goto('/');

    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible();

    // Try to send empty message
    await chatInput.fill('');
    const initialMessageCount = await page.locator('[role="status"]').count();

    // Press Enter with empty input — should not send
    await chatInput.press('Enter');
    await page.waitForTimeout(500);

    // No new messages should appear
    const finalMessageCount = await page.locator('[role="status"]').count();
    expect(finalMessageCount).toBe(initialMessageCount);
  });

  test('chat error state displays gracefully', async ({ page, context }) => {
    // Route to intercept and fail the chat API
    await context.route('**/api/chat', route => {
      route.abort('failed');
    });

    await page.goto('/');

    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible();

    await chatInput.fill('test message');
    await chatInput.press('Enter');

    // Error message or alert should appear
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 3000 });
  });

  test('chat message receives response and displays', async ({ page }) => {
    await page.goto('/');

    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible();

    // Send a message
    const messageText = 'What is my portfolio value?';
    await chatInput.fill(messageText);

    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/chat') && resp.status() === 200),
      chatInput.press('Enter'),
    ]);

    expect(response.status()).toBe(200);

    // Verify user message appears
    await expect(page.locator(`text=${messageText}`)).toBeVisible();

    // Verify AI response appears (at least one AI message bubble should exist)
    await expect(page.locator('.border-l-2.border-blue-primary')).toBeVisible();
  });
});
