import { create } from 'zustand'
import type { Portfolio, PortfolioSnapshot } from '@/types'

interface PortfolioState {
  portfolio: Portfolio | null
  history: PortfolioSnapshot[] | null
  isLoading: boolean
  setPortfolio: (portfolio: Portfolio) => void
  setHistory: (history: PortfolioSnapshot[]) => void
  setLoading: (loading: boolean) => void
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  portfolio: null,
  history: null,
  isLoading: false,

  setPortfolio: (portfolio: Portfolio) => set({ portfolio }),

  setHistory: (history: PortfolioSnapshot[]) => set({ history }),

  setLoading: (loading: boolean) => set({ isLoading: loading }),
}))
