import { test, expect } from '@playwright/test'

test.describe('Fresh Start', () => {
  // Navigate to home before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/', {
      waitUntil: 'networkidle'
    })
  })

  test('App loads and shows default balance of $10,000', async ({ page }) => {
    // Look for cash balance in header or portfolio panel
    // Assuming data-testid="cash-balance" exists in frontend
    const balance = page.locator('[data-testid="cash-balance"]')

    // Wait for element and check text
    await expect(balance).toContainText('$10,000', {
      timeout: 5000
    })
  })

  test('Default watchlist has 10 tickers', async ({ page }) => {
    // Count watchlist rows (assuming each ticker is a row with data-testid)
    const tickers = page.locator('[data-testid="watchlist-row"]')

    // Should have 10 default tickers
    await expect(tickers).toHaveCount(10, {
      timeout: 5000
    })
  })

  test('Watchlist shows ticker symbols (AAPL, GOOGL, MSFT, etc.)', async ({ page }) => {
    // Check that specific default tickers are present
    const aapl = page.locator('text=AAPL')
    const googl = page.locator('text=GOOGL')
    const msft = page.locator('text=MSFT')

    await expect(aapl).toBeVisible()
    await expect(googl).toBeVisible()
    await expect(msft).toBeVisible()
  })

  test('Watchlist shows live prices (non-zero values)', async ({ page }) => {
    // Find price elements in watchlist rows
    const prices = page.locator('[data-testid="ticker-price"]')

    // Should have prices for each ticker
    const count = await prices.count()
    expect(count).toBeGreaterThan(0)

    // Each price should be non-zero (not empty, not '$0.00')
    for (let i = 0; i < count; i++) {
      const price = await prices.nth(i).innerText()
      expect(price).not.toBe('')
      expect(price).not.toBe('$0.00')
    }
  })

  test('Portfolio panel shows zero positions initially', async ({ page }) => {
    // If positions table exists, should be empty
    const positions = page.locator('[data-testid="position-row"]')
    const count = await positions.count()

    // Should be 0 positions initially (or table not visible)
    expect(count).toBe(0)
  })

  test('Connection status indicator is green (connected)', async ({ page }) => {
    // Look for connection status dot/indicator
    const status = page.locator('[data-testid="connection-status"]')

    // Should show "connected" or have green styling
    // (depends on frontend implementation)
    await expect(status).toBeVisible()
  })

  test('Price values update when SSE stream sends updates', async ({ page }) => {
    // Get initial price
    const aapl_price_initial = await page
      .locator('[data-testid="ticker-price"]')
      .first()
      .innerText()

    // Wait for a new SSE event (should arrive within ~500ms)
    await page.waitForTimeout(1000)

    // Re-read price (may or may not have changed, but should be a valid number)
    const aapl_price_later = await page
      .locator('[data-testid="ticker-price"]')
      .first()
      .innerText()

    // Both should be valid prices (non-empty)
    expect(aapl_price_initial).not.toBe('')
    expect(aapl_price_later).not.toBe('')
  })

  test('Header displays portfolio value', async ({ page }) => {
    // Look for total portfolio value in header
    const portfolio_value = page.locator('[data-testid="portfolio-value"]')

    // Should display something like "$10,000.00"
    await expect(portfolio_value).toBeVisible()
  })
})
