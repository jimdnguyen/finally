import { create } from 'zustand'
import type { Portfolio } from '@/types'

interface PortfolioState {
  portfolio: Portfolio | null
  isLoading: boolean
  setPortfolio: (portfolio: Portfolio) => void
  setLoading: (loading: boolean) => void
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  portfolio: null,
  isLoading: false,

  setPortfolio: (portfolio: Portfolio) => set({ portfolio }),

  setLoading: (loading: boolean) => set({ isLoading: loading }),
}))
