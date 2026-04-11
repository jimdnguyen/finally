'use client'

import { useQuery } from '@tanstack/react-query'

export interface SnapshotRecord {
  total_value: number
  recorded_at: string  // ISO timestamp
}

export interface PortfolioHistoryResponse {
  snapshots: SnapshotRecord[]
}

export function usePortfolioHistory() {
  return useQuery({
    queryKey: ['portfolio', 'history'],
    queryFn: async () => {
      const res = await fetch('/api/portfolio/history')
      if (!res.ok) throw new Error(`Portfolio history fetch failed: ${res.status}`)
      return res.json() as Promise<PortfolioHistoryResponse>
    },
    // Poll every 30 seconds (matches backend snapshot interval)
    refetchInterval: 30 * 1000,
    staleTime: 0,  // Keep fresh, always refetch on interval
    gcTime: 5 * 60 * 1000,
    retry: 1,
  })
}
