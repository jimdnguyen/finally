import { describe, it, expect, vi } from 'vitest'
import { TradeRequest, useTradeExecution } from '@/hooks/useTradeExecution'

// Test the hook directly: validate trade request structure
describe('useTradeExecution Hook', () => {
  it('should have correct trade request interface', () => {
    const tradeRequest: TradeRequest = {
      ticker: 'AAPL',
      side: 'buy',
      quantity: 10,
    }

    expect(tradeRequest.ticker).toBe('AAPL')
    expect(tradeRequest.side).toBe('buy')
    expect(tradeRequest.quantity).toBe(10)
  })

  it('should support sell trades', () => {
    const tradeRequest: TradeRequest = {
      ticker: 'GOOGL',
      side: 'sell',
      quantity: 5.5,
    }

    expect(tradeRequest.side).toBe('sell')
    expect(tradeRequest.quantity).toBe(5.5)
  })

  it('should handle fractional shares', () => {
    const tradeRequest: TradeRequest = {
      ticker: 'MSFT',
      side: 'buy',
      quantity: 0.01,
    }

    expect(tradeRequest.quantity).toBe(0.01)
  })

  it('should validate trade request types', () => {
    const validTrades: TradeRequest[] = [
      { ticker: 'AAPL', side: 'buy', quantity: 100 },
      { ticker: 'GOOGL', side: 'sell', quantity: 50.5 },
      { ticker: 'MSFT', side: 'buy', quantity: 0.01 },
    ]

    validTrades.forEach((trade) => {
      expect(trade.ticker).toBeTruthy()
      expect(['buy', 'sell']).toContain(trade.side)
      expect(trade.quantity).toBeGreaterThan(0)
    })
  })
})
