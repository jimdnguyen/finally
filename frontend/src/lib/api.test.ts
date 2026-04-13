import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError, executeTrade, fetchPortfolio, addToWatchlist, removeFromWatchlist } from './api'
import type { Portfolio, WatchlistItem } from '@/types'

const mockPortfolio: Portfolio = {
  cash_balance: 8000,
  positions: [
    { ticker: 'AAPL', quantity: 10, avg_cost: 180, current_price: 190, unrealized_pnl: 100, pnl_pct: 5.56 },
  ],
  total_value: 9900,
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('executeTrade', () => {
  it('returns Portfolio on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPortfolio),
    }))

    const result = await executeTrade({ ticker: 'AAPL', quantity: 10, side: 'buy' })
    expect(result).toEqual(mockPortfolio)
    expect(fetch).toHaveBeenCalledWith('/api/portfolio/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: 'AAPL', quantity: 10, side: 'buy' }),
    })
  })

  it('throws ApiError with correct code and message on 400', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ error: 'Insufficient cash', code: 'INSUFFICIENT_CASH' }),
    }))

    await expect(executeTrade({ ticker: 'AAPL', quantity: 1000, side: 'buy' }))
      .rejects
      .toThrow(ApiError)

    try {
      await executeTrade({ ticker: 'AAPL', quantity: 1000, side: 'buy' })
    } catch (e) {
      const err = e as ApiError
      expect(err.message).toBe('Insufficient cash')
      expect(err.code).toBe('INSUFFICIENT_CASH')
    }
  })

  it('falls back to statusText when json parsing fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('parse error')),
    }))

    try {
      await executeTrade({ ticker: 'AAPL', quantity: 10, side: 'buy' })
    } catch (e) {
      const err = e as ApiError
      expect(err.message).toBe('Internal Server Error')
      expect(err.code).toBe('500')
    }
  })
})

describe('fetchPortfolio', () => {
  it('returns Portfolio on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPortfolio),
    }))

    const result = await fetchPortfolio()
    expect(result).toEqual(mockPortfolio)
  })
})

describe('addToWatchlist', () => {
  const mockItem: WatchlistItem = { ticker: 'PYPL', price: null }

  it('returns WatchlistItem on 201 success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(mockItem),
    }))

    const result = await addToWatchlist('PYPL')
    expect(result).toEqual(mockItem)
    expect(fetch).toHaveBeenCalledWith('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: 'PYPL' }),
    })
  })

  it('throws ApiError on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: () => Promise.resolve({ error: 'Ticker is required', code: 'INVALID_TICKER' }),
    }))

    try {
      await addToWatchlist('')
    } catch (e) {
      const err = e as ApiError
      expect(err.message).toBe('Ticker is required')
      expect(err.code).toBe('INVALID_TICKER')
    }
  })
})

describe('removeFromWatchlist', () => {
  it('returns void on 204 success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    }))

    const result = await removeFromWatchlist('AAPL')
    expect(result).toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('/api/watchlist/AAPL', { method: 'DELETE' })
  })

  it('throws ApiError on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'Ticker not found', code: 'TICKER_NOT_FOUND' }),
    }))

    try {
      await removeFromWatchlist('XYZ')
    } catch (e) {
      const err = e as ApiError
      expect(err.message).toBe('Ticker not found')
      expect(err.code).toBe('TICKER_NOT_FOUND')
    }
  })
})
