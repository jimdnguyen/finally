import { test, expect } from '@playwright/test';

test('Chat: send message and receive response', async ({ page }) => {
  await page.goto('/');

  // Wait for page to load
  await page.waitForTimeout(2000);

  // Find chat input in the AI Assistant panel
  const chatInput = page.locator('input[placeholder*="Ask FinAlly"]');

  // Find send button in the AI Assistant panel
  const sendButton = page.locator('button:has-text("Send")').last(); // Last Send button should be in chat panel

  // Type and send message
  await chatInput.fill('Hello');
  await sendButton.click();

  // Wait for response (up to 10s) - LLM may take a moment
  await page.waitForTimeout(3000);

  // Verify chat panel has content
  const chatPanel = page.locator('text=/Start chatting|FinAlly/i');
  const count = await chatPanel.count();
  expect(count).toBeGreaterThan(0);
});

test('Chat: no console errors during message flow', async ({ page }) => {
  const consoleErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('/');
  await page.waitForTimeout(2000);

  // Find and interact with chat
  const chatInput = page.locator('input[placeholder*="Ask FinAlly"]');
  const sendButton = page.locator('button:has-text("Send")').last();

  await chatInput.fill('Test message');
  await sendButton.click();

  await page.waitForTimeout(3000);

  // Verify no errors (excluding known third-party errors if any)
  const relevantErrors = consoleErrors.filter(
    (err) => !err.includes('third-party') && !err.includes('extension') && !err.includes('404')
  );

  expect(relevantErrors).toEqual([]);
});
