import { describe, it, expect, beforeEach } from 'vitest'
import { usePriceStore } from '@/store/priceStore'

describe('usePriceStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    const store = usePriceStore.getState()
    store.prices = {}
    store.history = {}
    store.status = 'connecting'
  })

  it('should initialize with connecting status', () => {
    expect(usePriceStore.getState().status).toBe('connecting')
  })

  it('should set price and update history with max 60 points', () => {
    const store = usePriceStore.getState()

    // Add 70 prices
    for (let i = 0; i < 70; i++) {
      store.setPrice('AAPL', {
        ticker: 'AAPL',
        price: 150 + i,
        previous_price: 150 + i - 1,
        timestamp: new Date().toISOString(),
        direction: 'up',
        change: 1,
        change_percent: 0.67,
      })
    }

    const history = usePriceStore.getState().history['AAPL']
    expect(history).toHaveLength(60)  // Should cap at 60
    expect(history[0]).toBe(160)  // Oldest entry (10th price, since we keep last 60 of 70)
    expect(history[59]).toBe(219)  // Newest entry (70th price)
  })

  it('should set status to live', () => {
    usePriceStore.getState().setStatus('live')
    expect(usePriceStore.getState().status).toBe('live')
  })

  it('should set status to reconnecting', () => {
    usePriceStore.getState().setStatus('reconnecting')
    expect(usePriceStore.getState().status).toBe('reconnecting')
  })
})
