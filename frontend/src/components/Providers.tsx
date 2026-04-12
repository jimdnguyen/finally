'use client'

import { useEffect } from 'react'
import { useSSE } from '@/hooks/useSSE'
import { fetchWatchlist, fetchPortfolio } from '@/lib/api'
import { useWatchlistStore } from '@/stores/watchlistStore'
import { usePortfolioStore } from '@/stores/portfolioStore'

export default function Providers({ children }: { children: React.ReactNode }) {
  useSSE()

  useEffect(() => {
    fetchWatchlist()
      .then((items) => useWatchlistStore.getState().setTickers(items.map((i) => i.ticker)))
      .catch(() => {})

    fetchPortfolio()
      .then((portfolio) => usePortfolioStore.getState().setPortfolio(portfolio))
      .catch(() => {})
  }, [])

  return <>{children}</>
}
