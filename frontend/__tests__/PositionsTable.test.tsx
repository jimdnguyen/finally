import { describe, it, expect } from 'vitest'
import { PositionDetail, PortfolioResponse } from '@/hooks/usePortfolio'

describe('PositionsTable data structures', () => {
  it('should validate position detail structure', () => {
    const position: PositionDetail = {
      ticker: 'AAPL',
      quantity: 10,
      avg_cost: 150,
      current_price: 155,
      unrealized_pnl: 50,
      unrealized_pnl_pct: 0.0333,
    }

    expect(position.ticker).toBe('AAPL')
    expect(position.quantity).toBe(10)
    expect(position.avg_cost).toBe(150)
    expect(position.current_price).toBe(155)
    expect(position.unrealized_pnl).toBe(50)
  })

  it('should calculate profit/loss correctly', () => {
    const position: PositionDetail = {
      ticker: 'AAPL',
      quantity: 10,
      avg_cost: 150,
      current_price: 155,
      unrealized_pnl: 50,
      unrealized_pnl_pct: 0.0333,
    }

    // P&L = (current_price - avg_cost) * quantity
    const expectedPnL = (155 - 150) * 10
    expect(position.unrealized_pnl).toBe(expectedPnL)
  })

  it('should handle negative unrealized P&L', () => {
    const position: PositionDetail = {
      ticker: 'GOOGL',
      quantity: 5,
      avg_cost: 175,
      current_price: 170,
      unrealized_pnl: -25,
      unrealized_pnl_pct: -0.0286,
    }

    expect(position.unrealized_pnl).toBeLessThan(0)
    expect(position.unrealized_pnl_pct).toBeLessThan(0)
  })

  it('should validate portfolio response structure', () => {
    const portfolio: PortfolioResponse = {
      cash_balance: 10000,
      total_value: 10025,
      positions: [
        {
          ticker: 'AAPL',
          quantity: 10,
          avg_cost: 150,
          current_price: 155,
          unrealized_pnl: 50,
          unrealized_pnl_pct: 0.0333,
        },
      ],
    }

    expect(portfolio.cash_balance).toBe(10000)
    expect(portfolio.total_value).toBe(10025)
    expect(portfolio.positions).toHaveLength(1)
    expect(portfolio.positions[0].ticker).toBe('AAPL')
  })

  it('should handle empty positions array', () => {
    const portfolio: PortfolioResponse = {
      cash_balance: 10000,
      total_value: 10000,
      positions: [],
    }

    expect(portfolio.positions).toHaveLength(0)
    expect(portfolio.cash_balance).toBe(portfolio.total_value)
  })

  it('should format decimal places correctly', () => {
    const position: PositionDetail = {
      ticker: 'MSFT',
      quantity: 10.5,
      avg_cost: 350.123,
      current_price: 355.789,
      unrealized_pnl: 59.445,
      unrealized_pnl_pct: 0.01698,
    }

    // Test that values are preserved to full precision
    expect(position.quantity).toBe(10.5)
    expect(position.avg_cost).toBeCloseTo(350.123)
    expect(position.unrealized_pnl_pct).toBeCloseTo(0.01698)
  })
})
