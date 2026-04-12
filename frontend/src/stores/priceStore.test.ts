import { describe, it, expect, beforeEach } from 'vitest'
import { usePriceStore } from './priceStore'
import type { PriceUpdate } from '@/types'

const FIXED_TS = '2026-01-01T00:00:00.000Z'
const FIXED_TIME = Math.floor(new Date(FIXED_TS).getTime() / 1000)

const makePriceUpdate = (ticker: string, price: number, timestamp = FIXED_TS): PriceUpdate => ({
  ticker,
  price,
  previous_price: price - 1,
  timestamp,
  direction: 'up',
  change: 1,
  change_percent: 0.5,
})

beforeEach(() => {
  usePriceStore.setState({ prices: {}, sparklines: {}, connectionStatus: 'disconnected', selectedTicker: 'AAPL' })
})

describe('priceStore', () => {
  it('updatePrice adds entry to prices', () => {
    const update = makePriceUpdate('AAPL', 191.23)
    usePriceStore.getState().updatePrice(update)
    expect(usePriceStore.getState().prices['AAPL']).toEqual(update)
  })

  it('updatePrice appends SparklinePoint to sparkline buffer', () => {
    usePriceStore.getState().updatePrice(makePriceUpdate('AAPL', 100))
    usePriceStore.getState().updatePrice(makePriceUpdate('AAPL', 101))
    expect(usePriceStore.getState().sparklines['AAPL']).toEqual([
      { time: FIXED_TIME, value: 100 },
      { time: FIXED_TIME, value: 101 },
    ])
  })

  it('SparklinePoint uses unix seconds derived from timestamp', () => {
    usePriceStore.getState().updatePrice(makePriceUpdate('MSFT', 300, FIXED_TS))
    const points = usePriceStore.getState().sparklines['MSFT']
    expect(points[0]).toEqual({ time: FIXED_TIME, value: 300 })
  })

  it('sparkline buffer is capped at 200 points', () => {
    for (let i = 0; i < 201; i++) {
      usePriceStore.getState().updatePrice(makePriceUpdate('AAPL', i))
    }
    const points = usePriceStore.getState().sparklines['AAPL']
    expect(points.length).toBe(200)
    expect(points[0].value).toBe(1)
    expect(points[199].value).toBe(200)
  })

  it('selectedTicker defaults to AAPL', () => {
    expect(usePriceStore.getState().selectedTicker).toBe('AAPL')
  })

  it('selectTicker updates selectedTicker', () => {
    usePriceStore.getState().selectTicker('GOOGL')
    expect(usePriceStore.getState().selectedTicker).toBe('GOOGL')
  })

  it('setConnectionStatus updates connectionStatus', () => {
    usePriceStore.getState().setConnectionStatus('connected')
    expect(usePriceStore.getState().connectionStatus).toBe('connected')
    usePriceStore.getState().setConnectionStatus('reconnecting')
    expect(usePriceStore.getState().connectionStatus).toBe('reconnecting')
  })
})
