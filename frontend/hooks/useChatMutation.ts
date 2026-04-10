import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ChatMessage } from './useChatMessages'

export interface ChatRequest {
  message: string
}

export interface ChatResponse {
  message: string
  trades?: Array<{ ticker: string; side: 'buy' | 'sell'; quantity: number }>
  watchlist_changes?: Array<{ ticker: string; action: 'add' | 'remove' }>
}

export function useChatMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: ChatRequest) => {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      if (!res.ok) throw new Error('Chat request failed')
      return (await res.json()) as ChatResponse
    },
    onSuccess: () => {
      // Invalidate chat history to refetch (backend appends new message)
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] })
      // Invalidate portfolio in case trades were executed
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio', 'history'] })
      // Invalidate watchlist in case changes were made
      queryClient.invalidateQueries({ queryKey: ['watchlist'] })
    },
  })
}
