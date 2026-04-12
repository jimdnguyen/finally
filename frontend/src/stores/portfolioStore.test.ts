import { describe, it, expect, beforeEach } from 'vitest'
import { usePortfolioStore } from './portfolioStore'
import type { Portfolio } from '@/types'

const mockPortfolio: Portfolio = {
  cash_balance: 5000,
  positions: [
    { ticker: 'AAPL', quantity: 10, avg_cost: 180, current_price: 191, unrealized_pnl: 110, pnl_pct: 6.1 },
  ],
  total_value: 6910,
}

beforeEach(() => {
  usePortfolioStore.setState({ portfolio: null, isLoading: false })
})

describe('portfolioStore', () => {
  it('initial state is null/false', () => {
    expect(usePortfolioStore.getState().portfolio).toBeNull()
    expect(usePortfolioStore.getState().isLoading).toBe(false)
  })

  it('setPortfolio updates store', () => {
    usePortfolioStore.getState().setPortfolio(mockPortfolio)
    expect(usePortfolioStore.getState().portfolio).toEqual(mockPortfolio)
  })
})
