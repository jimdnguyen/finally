import { create } from 'zustand'

export interface PriceUpdate {
  ticker: string
  price: number
  previous_price: number
  timestamp: string
  direction: 'up' | 'down' | 'flat'
  change: number
  change_percent: number
}

interface PriceState {
  prices: Record<string, PriceUpdate>
  history: Record<string, number[]>
  status: 'connecting' | 'live' | 'reconnecting'
  setPrice: (ticker: string, update: PriceUpdate) => void
  setStatus: (status: PriceState['status']) => void
}

export const usePriceStore = create<PriceState>((set) => ({
  prices: {},
  history: {},
  status: 'connecting',
  setPrice: (ticker, update) =>
    set((state) => ({
      prices: { ...state.prices, [ticker]: update },
      history: {
        ...state.history,
        [ticker]: [...(state.history[ticker] || []), update.price].slice(-60),
      },
    })),
  setStatus: (status) => set({ status }),
}))
