import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WatchlistPanel from './WatchlistPanel'
import { useWatchlistStore } from '@/stores/watchlistStore'
import { addToWatchlist, fetchWatchlist } from '@/lib/api'

vi.mock('./WatchlistRow', () => ({
  default: ({ ticker }: { ticker: string }) => <div data-testid={`row-${ticker}`}>{ticker}</div>,
}))

vi.mock('@/lib/api', () => ({
  addToWatchlist: vi.fn(),
  fetchWatchlist: vi.fn(),
  ApiError: class extends Error {
    code: string
    constructor(message: string, code: string) {
      super(message)
      this.code = code
    }
  },
}))

beforeEach(() => {
  useWatchlistStore.setState({ tickers: [] })
  vi.clearAllMocks()
})

describe('WatchlistPanel', () => {
  it('renders nothing when store has no tickers', () => {
    render(<WatchlistPanel />)
    expect(screen.queryAllByTestId(/^row-/)).toHaveLength(0)
  })

  it('renders tickers from watchlist store', () => {
    useWatchlistStore.setState({ tickers: ['AAPL', 'TSLA', 'NVDA'] })
    render(<WatchlistPanel />)
    expect(screen.getByTestId('row-AAPL')).toBeTruthy()
    expect(screen.getByTestId('row-TSLA')).toBeTruthy()
    expect(screen.getByTestId('row-NVDA')).toBeTruthy()
    expect(screen.getAllByTestId(/^row-/)).toHaveLength(3)
  })

  it('renders updated tickers when store changes', () => {
    useWatchlistStore.setState({ tickers: ['AAPL'] })
    const { rerender } = render(<WatchlistPanel />)
    expect(screen.getAllByTestId(/^row-/)).toHaveLength(1)

    useWatchlistStore.setState({ tickers: ['AAPL', 'GOOGL'] })
    rerender(<WatchlistPanel />)
    expect(screen.getAllByTestId(/^row-/)).toHaveLength(2)
    expect(screen.getByTestId('row-GOOGL')).toBeTruthy()
  })
})

describe('WatchlistPanel add-ticker', () => {
  it('renders add-ticker input', () => {
    render(<WatchlistPanel />)
    expect(screen.getByPlaceholderText('Add ticker...')).toBeTruthy()
  })

  it('shows validation error on empty submit', () => {
    render(<WatchlistPanel />)
    const input = screen.getByPlaceholderText('Add ticker...')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Enter a ticker symbol')).toBeTruthy()
  })

  it('clears validation error on next keypress', () => {
    render(<WatchlistPanel />)
    const input = screen.getByPlaceholderText('Add ticker...')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Enter a ticker symbol')).toBeTruthy()

    fireEvent.keyDown(input, { key: 'a' })
    expect(screen.queryByText('Enter a ticker symbol')).toBeNull()
  })

  it('calls addToWatchlist and refetches on Enter', async () => {
    vi.mocked(addToWatchlist).mockResolvedValue({ ticker: 'PYPL', price: null })
    vi.mocked(fetchWatchlist).mockResolvedValue([
      { ticker: 'AAPL', price: 190 },
      { ticker: 'PYPL', price: null },
    ])

    render(<WatchlistPanel />)
    const input = screen.getByPlaceholderText('Add ticker...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'pypl' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(addToWatchlist).toHaveBeenCalledWith('PYPL')
      expect(fetchWatchlist).toHaveBeenCalled()
    })
    expect(useWatchlistStore.getState().tickers).toEqual(['AAPL', 'PYPL'])
    expect(input.value).toBe('')
  })

  it('shows inline error on API failure', async () => {
    vi.mocked(addToWatchlist).mockRejectedValue(new Error('Ticker is required'))

    render(<WatchlistPanel />)
    const input = screen.getByPlaceholderText('Add ticker...')
    fireEvent.change(input, { target: { value: 'BAD' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('Ticker is required')).toBeTruthy()
    })
  })
})
