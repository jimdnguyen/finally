import { describe, it, expect, beforeEach } from 'vitest'
import { usePriceStore } from '@/store/priceStore'

describe('WatchlistRow data', () => {
  beforeEach(() => {
    usePriceStore.setState({
      prices: {
        AAPL: {
          ticker: 'AAPL',
          price: 150,
          previous_price: 149,
          timestamp: new Date().toISOString(),
          direction: 'up',
          change: 1,
          change_percent: 0.67,
        },
      },
      history: {
        AAPL: [145, 146, 147, 148, 149, 150],
      },
    })
  })

  it('should store ticker price data', () => {
    const prices = usePriceStore.getState().prices
    expect(prices.AAPL).toBeDefined()
    expect(prices.AAPL.price).toBe(150)
    expect(prices.AAPL.direction).toBe('up')
  })

  it('should store price change calculations', () => {
    const price = usePriceStore.getState().prices.AAPL
    expect(price.change).toBe(1)
    expect(price.change_percent).toBe(0.67)
  })

  it('should store price history', () => {
    const history = usePriceStore.getState().history.AAPL
    expect(history).toEqual([145, 146, 147, 148, 149, 150])
  })

  it('should update price and add to history', () => {
    const store = usePriceStore.getState()
    store.setPrice('AAPL', {
      ticker: 'AAPL',
      price: 151,
      previous_price: 150,
      timestamp: new Date().toISOString(),
      direction: 'up',
      change: 1,
      change_percent: 0.67,
    })

    const updated = usePriceStore.getState().prices.AAPL
    expect(updated.price).toBe(151)

    const history = usePriceStore.getState().history.AAPL
    expect(history[history.length - 1]).toBe(151)
  })
})
