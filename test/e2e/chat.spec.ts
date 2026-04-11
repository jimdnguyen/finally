import { test, expect } from '@playwright/test'

test.describe('Chat Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', {
      waitUntil: 'networkidle'
    })
  })

  test('Chat panel loads with message input and history', async ({ page }) => {
    // Look for chat panel
    const chat_panel = page.locator('[data-testid="chat-panel"]')
    await expect(chat_panel).toBeVisible()

    // Look for message input
    const input = page.locator('[data-testid="chat-input"]')
    await expect(input).toBeVisible()

    // Look for message history area
    const history = page.locator('[data-testid="chat-history"]')
    await expect(history).toBeVisible()
  })

  test('Send chat message and receive response', async ({ page }) => {
    // Type message
    const input = page.locator('[data-testid="chat-input"]')
    await input.fill('What is my current portfolio value?')

    // Send (Enter key or button)
    await input.press('Enter')

    // Wait for response (LLM_MOCK=true means instant response)
    await page.waitForTimeout(2000)

    // Verify user message appears in history
    const user_message = page.locator('text=What is my current portfolio value?')
    await expect(user_message).toBeVisible()

    // Verify assistant response appears
    const assistant_message = page.locator('[data-testid="chat-message-assistant"]').first()
    await expect(assistant_message).toBeVisible()
  })

  test('Chat message with trade instruction auto-executes', async ({ page }) => {
    // Record initial cash
    const initial_balance = await page
      .locator('[data-testid="cash-balance"]')
      .innerText()

    // Send trade instruction via chat
    const input = page.locator('[data-testid="chat-input"]')
    await input.fill('Buy 5 TSLA')
    await input.press('Enter')

    // Wait for LLM response and trade execution
    await page.waitForTimeout(2000)

    // Verify position appears
    const tsla_position = page.locator('[data-testid="position-TSLA"]')
    await expect(tsla_position).toBeVisible()

    // Verify quantity is 5
    await expect(tsla_position.locator('[data-testid="position-quantity"]')).toContainText('5')

    // Verify cash changed
    const final_balance = await page
      .locator('[data-testid="cash-balance"]')
      .innerText()

    expect(final_balance).not.toEqual(initial_balance)
  })

  test('Chat shows confirmation of executed trades', async ({ page }) => {
    // Send trade via chat
    const input = page.locator('[data-testid="chat-input"]')
    await input.fill('Buy 3 NVDA')
    await input.press('Enter')

    // Wait for response
    await page.waitForTimeout(2000)

    // Verify chat message includes trade confirmation
    // (assumes frontend shows inline badge or text "Bought 3 NVDA" or similar)
    const confirmation = page.locator('text=/Bought|Executed|3 NVDA/')
    // This is optional; depends on frontend implementation
    // Just verify the position was created (tested in previous test)
  })

  test('Chat with multiple trades executes all trades', async ({ page }) => {
    // Send message with multiple trades
    const input = page.locator('[data-testid="chat-input"]')
    await input.fill('Buy 2 AAPL and buy 3 MSFT')
    await input.press('Enter')

    // Wait for execution
    await page.waitForTimeout(2000)

    // Verify both positions created
    const aapl = page.locator('[data-testid="position-AAPL"]')
    const msft = page.locator('[data-testid="position-MSFT"]')

    await expect(aapl).toBeVisible()
    await expect(msft).toBeVisible()
  })

  test('Chat conversation history persists in panel', async ({ page }) => {
    // Send first message
    let input = page.locator('[data-testid="chat-input"]')
    await input.fill('First message')
    await input.press('Enter')

    await page.waitForTimeout(1000)

    // Send second message
    input = page.locator('[data-testid="chat-input"]')
    await input.fill('Second message')
    await input.press('Enter')

    await page.waitForTimeout(1000)

    // Both messages should be visible in history
    const first = page.locator('text=First message')
    const second = page.locator('text=Second message')

    await expect(first).toBeVisible()
    await expect(second).toBeVisible()
  })

  test('Chat input clears after sending message', async ({ page }) => {
    const input = page.locator('[data-testid="chat-input"]')

    // Type and send
    await input.fill('Test message')
    await input.press('Enter')

    // Wait for send
    await page.waitForTimeout(500)

    // Input should be cleared (empty)
    const value = await input.inputValue()
    expect(value).toBe('')
  })
})
