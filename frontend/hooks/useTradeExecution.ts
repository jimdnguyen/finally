'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

export interface TradeRequest {
  ticker: string
  side: 'buy' | 'sell'
  quantity: number
}

export interface TradeResponse {
  success: boolean
  message?: string
  error?: string
}

export function useTradeExecution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (trade: TradeRequest) => {
      const res = await fetch('/api/portfolio/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trade),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: 'Trade failed' }))
        throw new Error(error.detail || error.message || 'Trade execution failed')
      }

      return res.json() as Promise<TradeResponse>
    },
    onSuccess: () => {
      // Invalidate portfolio queries to trigger refetch on success
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio', 'history'] })
    },
    onError: (error) => {
      console.error('Trade execution error:', error)
    },
  })
}
