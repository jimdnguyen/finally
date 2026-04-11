import { useQuery } from '@tanstack/react-query'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: {
    trades?: Array<{ ticker: string; side: 'buy' | 'sell'; quantity: number }>
    watchlist_changes?: Array<{ ticker: string; action: 'add' | 'remove' }>
  }
  created_at: string
}

export function useChatMessages() {
  return useQuery({
    queryKey: ['chat', 'messages'],
    queryFn: async () => {
      const res = await fetch('/api/chat/history')
      if (!res.ok) throw new Error('Failed to load chat history')
      return (await res.json()) as ChatMessage[]
    },
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  })
}
