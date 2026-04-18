import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import WatchlistRow from './WatchlistRow'
import { usePriceStore } from '@/stores/priceStore'
import { useWatchlistStore } from '@/stores/watchlistStore'
import { removeFromWatchlist, fetchWatchlist } from '@/lib/api'
import type { PriceUpdate } from '@/types'

vi.mock('@/lib/api', () => ({
  removeFromWatchlist: vi.fn(),
  fetchWatchlist: vi.fn(),
}))

// Mock SparklineChart to avoid LightweightCharts DOM complexity in these tests
vi.mock('./SparklineChart', () => ({
  default: () => <div data-testid="sparkline" />,
}))

const makeUpdate = (ticker: string, price: number, prev: number): PriceUpdate => ({
  ticker,
  price,
  previous_price: prev,
  timestamp: new Date().toISOString(),
  direction: price >= prev ? 'up' : 'down',
  change: price - prev,
  change_percent: ((price - prev) / prev) * 100,
})

beforeEach(() => {
  usePriceStore.setState({ prices: {}, sparklines: {}, connectionStatus: 'disconnected', selectedTicker: 'AAPL' })
})

describe('WatchlistRow', () => {
  it('renders ticker symbol', () => {
    render(<WatchlistRow ticker="AAPL" />)
    expect(screen.getByText('AAPL')).toBeTruthy()
  })

  it('shows — placeholders before any price arrives', () => {
    render(<WatchlistRow ticker="AAPL" />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })

  it('shows price and positive % change after price update', () => {
    act(() => {
      usePriceStore.getState().updatePrice(makeUpdate('AAPL', 200, 190))
    })
    render(<WatchlistRow ticker="AAPL" />)
    expect(screen.getByText('$200.00')).toBeTruthy()
    expect(screen.getByText('+5.26%')).toBeTruthy()
  })

  it('shows negative % change with U+2212 minus sign', () => {
    act(() => {
      usePriceStore.getState().updatePrice(makeUpdate('AAPL', 190, 200))
    })
    render(<WatchlistRow ticker="AAPL" />)
    // U+2212 is '−' (not ASCII hyphen)
    expect(screen.getByText('\u22125.00%')).toBeTruthy()
  })

  it('applies flash-green class on uptick', () => {
    act(() => {
      usePriceStore.getState().updatePrice(makeUpdate('AAPL', 200, 190))
    })
    const { container } = render(<WatchlistRow ticker="AAPL" />)
    const row = container.firstChild as HTMLElement
    expect(row.classList.contains('flash-green')).toBe(true)
  })

  it('applies flash-red class on downtick', () => {
    act(() => {
      usePriceStore.getState().updatePrice(makeUpdate('AAPL', 190, 200))
    })
    const { container } = render(<WatchlistRow ticker="AAPL" />)
    const row = container.firstChild as HTMLElement
    expect(row.classList.contains('flash-red')).toBe(true)
  })

  it('renders sparkline component', () => {
    render(<WatchlistRow ticker="AAPL" />)
    expect(screen.getByTestId('sparkline')).toBeTruthy()
  })

  it('shows active border when ticker matches selectedTicker', () => {
    usePriceStore.setState({ selectedTicker: 'AAPL' })
    const { container } = render(<WatchlistRow ticker="AAPL" />)
    const row = container.firstChild as HTMLElement
    expect(row.className).toContain('border-l-blue-primary')
  })

  it('shows transparent border when ticker does not match selectedTicker', () => {
    usePriceStore.setState({ selectedTicker: 'GOOGL' })
    const { container } = render(<WatchlistRow ticker="AAPL" />)
    const row = container.firstChild as HTMLElement
    expect(row.className).toContain('border-l-transparent')
  })

  it('click calls selectTicker with the row ticker', () => {
    usePriceStore.setState({ selectedTicker: 'GOOGL' })
    const { container } = render(<WatchlistRow ticker="AAPL" />)
    const row = container.firstChild as HTMLElement
    fireEvent.click(row)
    expect(usePriceStore.getState().selectedTicker).toBe('AAPL')
  })

  it('renders × remove button with aria-label', () => {
    render(<WatchlistRow ticker="AAPL" />)
    const btn = screen.getByRole('button', { name: 'Remove AAPL from watchlist' })
    expect(btn).toBeTruthy()
    expect(btn.textContent).toBe('×')
  })

  it('× click calls removeFromWatchlist and refetches', async () => {
    vi.mocked(removeFromWatchlist).mockResolvedValue(undefined)
    vi.mocked(fetchWatchlist).mockResolvedValue([{ ticker: 'GOOGL', price: 175 }])
    useWatchlistStore.setState({ tickers: ['AAPL', 'GOOGL'] })

    render(<WatchlistRow ticker="AAPL" />)
    const btn = screen.getByRole('button', { name: 'Remove AAPL from watchlist' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(removeFromWatchlist).toHaveBeenCalledWith('AAPL')
      expect(fetchWatchlist).toHaveBeenCalled()
    })
    expect(useWatchlistStore.getState().tickers).toEqual(['GOOGL'])
  })

  it('× click does not trigger row selectTicker', async () => {
    vi.mocked(removeFromWatchlist).mockResolvedValue(undefined)
    vi.mocked(fetchWatchlist).mockResolvedValue([{ ticker: 'AAPL', price: 190 }])
    usePriceStore.setState({ selectedTicker: 'GOOGL' })

    render(<WatchlistRow ticker="AAPL" />)
    const btn = screen.getByRole('button', { name: 'Remove AAPL from watchlist' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(removeFromWatchlist).toHaveBeenCalled()
    })
    // selectedTicker should NOT have changed to AAPL
    expect(usePriceStore.getState().selectedTicker).toBe('GOOGL')
  })
})
