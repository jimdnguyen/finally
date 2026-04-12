import { create } from 'zustand'
import type { ConnectionStatus, PriceUpdate } from '@/types'

export type SparklinePoint = { time: number; value: number }

const SPARKLINE_CAP = 200

interface PriceState {
  prices: Record<string, PriceUpdate>
  sparklines: Record<string, SparklinePoint[]>
  connectionStatus: ConnectionStatus
  selectedTicker: string
  updatePrice: (update: PriceUpdate) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  selectTicker: (ticker: string) => void
}

export const usePriceStore = create<PriceState>((set) => ({
  prices: {},
  sparklines: {},
  connectionStatus: 'disconnected',
  selectedTicker: 'AAPL',

  updatePrice: (update: PriceUpdate) =>
    set((state) => {
      const existing = state.sparklines[update.ticker] ?? []
      const point: SparklinePoint = {
        time: Math.floor(new Date(update.timestamp).getTime() / 1000),
        value: update.price,
      }
      const appended = [...existing, point]
      return {
        prices: { ...state.prices, [update.ticker]: update },
        sparklines: {
          ...state.sparklines,
          [update.ticker]:
            appended.length > SPARKLINE_CAP
              ? appended.slice(-SPARKLINE_CAP)
              : appended,
        },
      }
    }),

  setConnectionStatus: (status: ConnectionStatus) =>
    set({ connectionStatus: status }),

  selectTicker: (ticker: string) =>
    set({ selectedTicker: ticker }),
}))
