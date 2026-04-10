import { describe, it, expect } from 'vitest'
import type { ChatMessage } from '@/hooks/useChatMessages'
import type { ChatRequest, ChatResponse } from '@/hooks/useChatMutation'

describe('Chat Data Structures', () => {
  it('validates ChatMessage structure for user messages', () => {
    const message: ChatMessage = {
      id: '1',
      role: 'user',
      content: 'What should I buy?',
      created_at: '2025-04-10T12:00:00Z',
    }

    expect(message.id).toBeDefined()
    expect(message.role).toBe('user')
    expect(message.content).toBeDefined()
    expect(message.created_at).toBeDefined()
  })

  it('validates ChatMessage structure for assistant messages', () => {
    const message: ChatMessage = {
      id: '2',
      role: 'assistant',
      content: 'I recommend AAPL',
      actions: {
        trades: [{ ticker: 'AAPL', side: 'buy', quantity: 10 }],
      },
      created_at: '2025-04-10T12:01:00Z',
    }

    expect(message.id).toBeDefined()
    expect(message.role).toBe('assistant')
    expect(message.content).toBeDefined()
    expect(message.actions?.trades).toBeDefined()
    expect(message.actions?.trades?.[0].side).toBe('buy')
  })

  it('validates ChatRequest structure', () => {
    const request: ChatRequest = {
      message: 'Buy 10 AAPL',
    }

    expect(request.message).toBeDefined()
    expect(typeof request.message).toBe('string')
  })

  it('validates ChatResponse structure with trades', () => {
    const response: ChatResponse = {
      message: 'Buying 10 shares of AAPL',
      trades: [
        { ticker: 'AAPL', side: 'buy', quantity: 10 },
      ],
    }

    expect(response.message).toBeDefined()
    expect(response.trades).toBeDefined()
    expect(Array.isArray(response.trades)).toBe(true)
    expect(response.trades[0].ticker).toBe('AAPL')
    expect(response.trades[0].side).toBe('buy')
  })

  it('validates ChatResponse structure with watchlist changes', () => {
    const response: ChatResponse = {
      message: 'Added GOOGL to watchlist',
      watchlist_changes: [
        { ticker: 'GOOGL', action: 'add' },
      ],
    }

    expect(response.message).toBeDefined()
    expect(response.watchlist_changes).toBeDefined()
    expect(Array.isArray(response.watchlist_changes)).toBe(true)
    expect(response.watchlist_changes[0].action).toBe('add')
  })

  it('validates ChatResponse with both trades and watchlist changes', () => {
    const response: ChatResponse = {
      message: 'Rebalancing your portfolio',
      trades: [
        { ticker: 'AAPL', side: 'sell', quantity: 5 },
        { ticker: 'MSFT', side: 'buy', quantity: 3 },
      ],
      watchlist_changes: [
        { ticker: 'NVDA', action: 'add' },
      ],
    }

    expect(response.trades?.length).toBe(2)
    expect(response.watchlist_changes?.length).toBe(1)
    expect(response.trades?.[0].side).toBe('sell')
    expect(response.trades?.[1].side).toBe('buy')
  })

  it('allows empty trades and watchlist_changes arrays', () => {
    const response: ChatResponse = {
      message: 'Just a message with no actions',
      trades: [],
      watchlist_changes: [],
    }

    expect(response.trades).toHaveLength(0)
    expect(response.watchlist_changes).toHaveLength(0)
  })

  it('validates message history array structure', () => {
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        created_at: '2025-04-10T12:00:00Z',
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Hi there',
        created_at: '2025-04-10T12:01:00Z',
      },
    ]

    expect(Array.isArray(messages)).toBe(true)
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('user')
    expect(messages[1].role).toBe('assistant')
  })
})
