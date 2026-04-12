import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import WatchlistPanel from './WatchlistPanel'

// Mock WatchlistRow to isolate WatchlistPanel logic
vi.mock('./WatchlistRow', () => ({
  default: ({ ticker }: { ticker: string }) => <div data-testid={`row-${ticker}`}>{ticker}</div>,
}))

const DEFAULT_COUNT = 10

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('WatchlistPanel', () => {
  it('renders 10 default tickers before API responds', async () => {
    // fetch never resolves
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}))
    render(<WatchlistPanel />)
    const rows = screen.getAllByTestId(/^row-/)
    expect(rows.length).toBe(DEFAULT_COUNT)
  })

  it('renders tickers from API response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => [{ ticker: 'AAPL' }, { ticker: 'TSLA' }],
    } as Response)
    render(<WatchlistPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('row-AAPL')).toBeTruthy()
      expect(screen.getByTestId('row-TSLA')).toBeTruthy()
      expect(screen.getAllByTestId(/^row-/).length).toBe(2)
    })
  })

  it('falls back to defaults when API returns empty array', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => [],
    } as Response)
    render(<WatchlistPanel />)
    await waitFor(() => {
      expect(screen.getAllByTestId(/^row-/).length).toBe(DEFAULT_COUNT)
    })
  })

  it('falls back to defaults when API fetch fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))
    render(<WatchlistPanel />)
    await waitFor(() => {
      expect(screen.getAllByTestId(/^row-/).length).toBe(DEFAULT_COUNT)
    })
  })
})
