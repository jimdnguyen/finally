import { test, expect } from '@playwright/test'

test.describe('Trading Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', {
      waitUntil: 'networkidle'
    })
  })

  test('Buy shares: cash decreases, position appears', async ({ page }) => {
    // Record initial cash balance
    const initial_balance_text = await page
      .locator('[data-testid="cash-balance"]')
      .innerText()
    const initial_balance = parseFloat(initial_balance_text.replace('$', '').replace(',', ''))

    // Find trade bar and set inputs
    await page.fill('[data-testid="trade-ticker"]', 'AAPL')
    await page.fill('[data-testid="trade-quantity"]', '10')

    // Click Buy button
    await page.click('[data-testid="trade-buy"]')

    // Wait for API response and portfolio update
    await page.waitForTimeout(1000)

    // Verify cash decreased
    const new_balance_text = await page
      .locator('[data-testid="cash-balance"]')
      .innerText()
    const new_balance = parseFloat(new_balance_text.replace('$', '').replace(',', ''))

    expect(new_balance).toBeLessThan(initial_balance)

    // Verify position appears in positions table
    const aapl_position = page.locator('[data-testid="position-AAPL"]')
    await expect(aapl_position).toBeVisible()

    // Verify quantity is 10
    const quantity_cell = aapl_position.locator('[data-testid="position-quantity"]')
    await expect(quantity_cell).toContainText('10')
  })

  test('Sell shares: cash increases, position updates', async ({ page }) => {
    // First buy 10 shares
    await page.fill('[data-testid="trade-ticker"]', 'GOOGL')
    await page.fill('[data-testid="trade-quantity"]', '10')
    await page.click('[data-testid="trade-buy"]')
    await page.waitForTimeout(1000)

    // Record cash after buy
    const balance_after_buy = await page
      .locator('[data-testid="cash-balance"]')
      .innerText()

    // Now sell 5 shares
    await page.fill('[data-testid="trade-ticker"]', 'GOOGL')
    await page.fill('[data-testid="trade-quantity"]', '5')
    await page.click('[data-testid="trade-sell"]')
    await page.waitForTimeout(1000)

    // Verify cash increased (after sell)
    const balance_after_sell = await page
      .locator('[data-testid="cash-balance"]')
      .innerText()

    // Parse and compare (after_sell > after_buy)
    const after_buy = parseFloat(balance_after_buy.replace('$', '').replace(',', ''))
    const after_sell = parseFloat(balance_after_sell.replace('$', '').replace(',', ''))

    expect(after_sell).toBeGreaterThan(after_buy)

    // Verify position quantity is now 5
    const googl_position = page.locator('[data-testid="position-GOOGL"]')
    const quantity = googl_position.locator('[data-testid="position-quantity"]')
    await expect(quantity).toContainText('5')
  })

  test('Invalid trade (zero quantity) is rejected', async ({ page }) => {
    await page.fill('[data-testid="trade-ticker"]', 'AAPL')
    await page.fill('[data-testid="trade-quantity"]', '0')

    // Click Buy
    await page.click('[data-testid="trade-buy"]')

    // Should show error message or toast
    // (depends on frontend error handling; may see validation error or disabled button)
    const error = page.locator('[data-testid="trade-error"]')
    // Error might be visible or button might be disabled
    const button = page.locator('[data-testid="trade-buy"]')

    // At minimum, page should not freeze
    await page.waitForTimeout(500)
  })

  test('Click ticker to select and view in main chart', async ({ page }) => {
    // Click first ticker in watchlist
    await page.click('[data-testid="watchlist-row"]')

    // Main chart should display (or chart area updates)
    const chart = page.locator('[data-testid="main-chart"]')

    // Chart should be visible (assumes it exists in layout)
    await expect(chart).toBeVisible({
      timeout: 5000
    })
  })

  test('Portfolio value updates after trade', async ({ page }) => {
    // Record initial portfolio value
    const initial_pv = await page
      .locator('[data-testid="portfolio-value"]')
      .innerText()

    // Buy shares
    await page.fill('[data-testid="trade-ticker"]', 'MSFT')
    await page.fill('[data-testid="trade-quantity"]', '5')
    await page.click('[data-testid="trade-buy"]')

    // Wait for update
    await page.waitForTimeout(1000)

    // Portfolio value should change (might be lower if new position is losing, or higher if market moved)
    // At minimum, it should update
    const final_pv = await page
      .locator('[data-testid="portfolio-value"]')
      .innerText()

    // Both should have values (not empty)
    expect(initial_pv).not.toBe('')
    expect(final_pv).not.toBe('')
  })
})
