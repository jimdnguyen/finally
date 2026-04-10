'use client'

import { useQuery } from '@tanstack/react-query'

export interface PositionDetail {
  ticker: string
  quantity: number
  avg_cost: number
  current_price: number
  unrealized_pnl: number
  unrealized_pnl_pct?: number
}

export interface PortfolioResponse {
  cash_balance: number
  total_value: number
  positions: PositionDetail[]
}

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const res = await fetch('/api/portfolio')
      if (!res.ok) throw new Error(`Portfolio fetch failed: ${res.status}`)
      return res.json() as Promise<PortfolioResponse>
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  })
}
