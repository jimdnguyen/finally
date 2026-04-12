import { create } from 'zustand'

interface WatchlistState {
  tickers: string[]
  isLoading: boolean
  setTickers: (tickers: string[]) => void
  addTicker: (ticker: string) => void
  removeTicker: (ticker: string) => void
  setLoading: (loading: boolean) => void
}

export const useWatchlistStore = create<WatchlistState>((set) => ({
  tickers: [],
  isLoading: false,

  setTickers: (tickers: string[]) => set({ tickers }),

  addTicker: (ticker: string) =>
    set((state) => ({
      tickers: state.tickers.includes(ticker) ? state.tickers : [...state.tickers, ticker],
    })),

  removeTicker: (ticker: string) =>
    set((state) => ({ tickers: state.tickers.filter((t) => t !== ticker) })),

  setLoading: (loading: boolean) => set({ isLoading: loading }),
}))
