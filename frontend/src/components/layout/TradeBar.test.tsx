import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TradeBar from './TradeBar'
import { usePriceStore } from '@/stores/priceStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import type { Portfolio } from '@/types'

vi.mock('@/lib/api', () => ({
  executeTrade: vi.fn(),
  fetchPortfolioHistory: vi.fn(),
}))

import { executeTrade, fetchPortfolioHistory } from '@/lib/api'
const mockExecuteTrade = vi.mocked(executeTrade)
const mockFetchHistory = vi.mocked(fetchPortfolioHistory)

const mockPortfolio: Portfolio = {
  cash_balance: 8000,
  positions: [{ ticker: 'AAPL', quantity: 10, avg_cost: 180, current_price: 190, unrealized_pnl: 100, pnl_pct: 5.56 }],
  total_value: 9900,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchHistory.mockResolvedValue([])
  usePriceStore.setState({ selectedTicker: 'AAPL' })
  usePortfolioStore.setState({ portfolio: null, history: null, isLoading: false })
})

describe('TradeBar', () => {
  it('renders ticker input, quantity input, Buy and Sell buttons', () => {
    render(<TradeBar />)
    expect(screen.getByPlaceholderText('AAPL')).toBeTruthy()
    expect(screen.getByPlaceholderText('100')).toBeTruthy()
    expect(screen.getByRole('button', { name: /buy/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /sell/i })).toBeTruthy()
  })

  it('ticker input pre-fills from selectedTicker in priceStore', () => {
    usePriceStore.setState({ selectedTicker: 'TSLA' })
    render(<TradeBar />)
    expect(screen.getByPlaceholderText('AAPL')).toHaveProperty('value', 'TSLA')
  })

  it('buttons show purple background and uppercase text', () => {
    render(<TradeBar />)
    const buyBtn = screen.getByRole('button', { name: /buy/i })
    expect(buyBtn.className).toContain('bg-purple-action')
    expect(buyBtn.className).toContain('uppercase')
  })

  it('buttons disabled during submission', async () => {
    let resolvePromise: (value: Portfolio) => void
    mockExecuteTrade.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve }))

    render(<TradeBar />)
    const qtyInput = screen.getByPlaceholderText('100')
    fireEvent.change(qtyInput, { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /buy/i }))

    const buyBtn = screen.getByRole('button', { name: /buy/i })
    const sellBtn = screen.getByRole('button', { name: /sell/i })
    expect(buyBtn).toHaveProperty('disabled', true)
    expect(sellBtn).toHaveProperty('disabled', true)
    expect(buyBtn.className).toContain('disabled:opacity-40')

    resolvePromise!(mockPortfolio)
    await waitFor(() => {
      expect(buyBtn).toHaveProperty('disabled', false)
    })
  })

  it('successful trade calls executeTrade and refetches portfolio', async () => {
    mockExecuteTrade.mockResolvedValue(mockPortfolio)

    render(<TradeBar />)
    fireEvent.change(screen.getByPlaceholderText('100'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /buy/i }))

    await waitFor(() => {
      expect(mockExecuteTrade).toHaveBeenCalledWith({ ticker: 'AAPL', quantity: 10, side: 'buy' })
    })
    expect(usePortfolioStore.getState().portfolio).toEqual(mockPortfolio)
  })

  it('failed trade shows inline error text in red', async () => {
    mockExecuteTrade.mockRejectedValue(new Error('Insufficient cash'))

    render(<TradeBar />)
    fireEvent.change(screen.getByPlaceholderText('100'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /buy/i }))

    await waitFor(() => {
      const errorEl = screen.getByText('Insufficient cash')
      expect(errorEl.className).toContain('text-red-down')
    })
  })

  it('error clears on next submit attempt', async () => {
    mockExecuteTrade.mockRejectedValueOnce(new Error('Insufficient cash'))
    mockExecuteTrade.mockResolvedValueOnce(mockPortfolio)

    render(<TradeBar />)
    fireEvent.change(screen.getByPlaceholderText('100'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /buy/i }))

    await waitFor(() => {
      expect(screen.getByText('Insufficient cash')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /buy/i }))

    await waitFor(() => {
      expect(screen.queryByText('Insufficient cash')).toBeNull()
    })
  })

  it('Enter key in quantity field triggers buy', async () => {
    mockExecuteTrade.mockResolvedValue(mockPortfolio)

    render(<TradeBar />)
    const qtyInput = screen.getByPlaceholderText('100')
    fireEvent.change(qtyInput, { target: { value: '5' } })
    fireEvent.keyDown(qtyInput, { key: 'Enter' })

    await waitFor(() => {
      expect(mockExecuteTrade).toHaveBeenCalledWith({ ticker: 'AAPL', quantity: 5, side: 'buy' })
    })
  })

  it('successful trade also refetches portfolio history', async () => {
    const mockHistory = [{ recorded_at: '2026-04-12T10:00:00Z', total_value: 9900 }]
    mockExecuteTrade.mockResolvedValue(mockPortfolio)
    mockFetchHistory.mockResolvedValue(mockHistory)

    render(<TradeBar />)
    fireEvent.change(screen.getByPlaceholderText('100'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /buy/i }))

    await waitFor(() => {
      expect(mockFetchHistory).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(usePortfolioStore.getState().history).toEqual(mockHistory)
    })
  })
})
