'use client'

import { useQuery } from '@tanstack/react-query'

export interface WatchlistItem {
  ticker: string
  price: number
  previous_price: number
  direction: string
  change_amount: number
}

export function useWatchlist() {
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: async () => {
      const res = await fetch('/api/watchlist')
      if (!res.ok) throw new Error(`Watchlist fetch failed: ${res.status}`)
      const data = await res.json()
      return data.watchlist as WatchlistItem[]
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  })
}
