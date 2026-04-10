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
    onMutate: async (request: ChatRequest) => {
      // Cancel any in-flight refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ['chat', 'messages'] })

      // Snapshot current messages for rollback on error
      const previous = queryClient.getQueryData<ChatMessage[]>(['chat', 'messages'])

      // Optimistically append the user's message immediately
      const optimisticMessage: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        role: 'user',
        content: request.message,
        created_at: new Date().toISOString(),
      }
      queryClient.setQueryData<ChatMessage[]>(['chat', 'messages'], (old = []) => [
        ...old,
        optimisticMessage,
      ])

      return { previous }
    },
    onError: (_err, _req, context) => {
      // Roll back optimistic update on failure
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['chat', 'messages'], context.previous)
      }
    },
    onSettled: () => {
      // Always refetch to get real messages (replaces optimistic entry + adds assistant reply)
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] })
      // Invalidate portfolio in case trades were executed
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio', 'history'] })
      // Invalidate watchlist in case changes were made
      queryClient.invalidateQueries({ queryKey: ['watchlist'] })
    },
  })
}
