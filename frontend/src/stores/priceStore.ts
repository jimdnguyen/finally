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
      const lastTime = existing.length > 0 ? (existing[existing.length - 1].time as number) : -1
      const nowSec = Math.floor(Date.now() / 1000)
      const point: SparklinePoint = {
        time: nowSec > lastTime ? nowSec : lastTime + 1,
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
