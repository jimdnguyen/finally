import { describe, it, expect, beforeEach } from 'vitest'
import { usePortfolioStore } from './portfolioStore'
import type { Portfolio, PortfolioSnapshot } from '@/types'

const mockPortfolio: Portfolio = {
  cash_balance: 5000,
  positions: [
    { ticker: 'AAPL', quantity: 10, avg_cost: 180, current_price: 191, unrealized_pnl: 110, pnl_pct: 6.1 },
  ],
  total_value: 6910,
}

beforeEach(() => {
  usePortfolioStore.setState({ portfolio: null, history: null, isLoading: false })
})

describe('portfolioStore', () => {
  it('initial state is null/false', () => {
    expect(usePortfolioStore.getState().portfolio).toBeNull()
    expect(usePortfolioStore.getState().history).toBeNull()
    expect(usePortfolioStore.getState().isLoading).toBe(false)
  })

  it('setPortfolio updates store', () => {
    usePortfolioStore.getState().setPortfolio(mockPortfolio)
    expect(usePortfolioStore.getState().portfolio).toEqual(mockPortfolio)
  })

  it('setHistory updates store', () => {
    const mockHistory: PortfolioSnapshot[] = [
      { recorded_at: '2026-04-12T10:00:00Z', total_value: 10000 },
      { recorded_at: '2026-04-12T10:00:30Z', total_value: 10050 },
    ]
    usePortfolioStore.getState().setHistory(mockHistory)
    expect(usePortfolioStore.getState().history).toEqual(mockHistory)
  })

  it('setHistory with empty array is distinct from null', () => {
    usePortfolioStore.getState().setHistory([])
    expect(usePortfolioStore.getState().history).toEqual([])
    expect(usePortfolioStore.getState().history).not.toBeNull()
  })
})
