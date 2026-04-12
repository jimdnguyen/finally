import { describe, it, expect, beforeEach } from 'vitest'
import { useWatchlistStore } from './watchlistStore'

beforeEach(() => {
  useWatchlistStore.setState({ tickers: [], isLoading: false })
})

describe('watchlistStore', () => {
  it('setTickers populates tickers array', () => {
    useWatchlistStore.getState().setTickers(['AAPL', 'GOOGL'])
    expect(useWatchlistStore.getState().tickers).toEqual(['AAPL', 'GOOGL'])
  })

  it('addTicker appends unique ticker', () => {
    useWatchlistStore.getState().setTickers(['AAPL'])
    useWatchlistStore.getState().addTicker('GOOGL')
    useWatchlistStore.getState().addTicker('AAPL') // duplicate — should not add
    expect(useWatchlistStore.getState().tickers).toEqual(['AAPL', 'GOOGL'])
  })

  it('removeTicker removes by value', () => {
    useWatchlistStore.getState().setTickers(['AAPL', 'GOOGL', 'MSFT'])
    useWatchlistStore.getState().removeTicker('GOOGL')
    expect(useWatchlistStore.getState().tickers).toEqual(['AAPL', 'MSFT'])
  })
})
