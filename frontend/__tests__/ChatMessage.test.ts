import { describe, it, expect } from 'vitest'
import type { ChatMessage } from '@/hooks/useChatMessages'

describe('ChatMessage Data Structure Validation', () => {
  it('validates user message structure', () => {
    const message: ChatMessage = {
      id: '1',
      role: 'user',
      content: 'What is my portfolio?',
      created_at: '2025-04-10T12:00:00Z',
    }

    expect(message.id).toEqual('1')
    expect(message.role).toEqual('user')
    expect(message.content).toEqual('What is my portfolio?')
    expect(message.created_at).toEqual('2025-04-10T12:00:00Z')
  })

  it('validates assistant message structure', () => {
    const message: ChatMessage = {
      id: '2',
      role: 'assistant',
      content: 'Your portfolio is worth $12,500',
      created_at: '2025-04-10T12:01:00Z',
    }

    expect(message.role).toEqual('assistant')
    expect(message.content).toBeDefined()
    expect(message.content.length).toBeGreaterThan(0)
  })

  it('validates message with trade actions', () => {
    const message: ChatMessage = {
      id: '3',
      role: 'assistant',
      content: 'Buying AAPL',
      actions: {
        trades: [{ ticker: 'AAPL', side: 'buy', quantity: 10 }],
      },
      created_at: '2025-04-10T12:02:00Z',
    }

    expect(message.actions?.trades).toBeDefined()
    expect(message.actions!.trades).toHaveLength(1)
    expect(message.actions!.trades[0].ticker).toEqual('AAPL')
    expect(message.actions!.trades[0].side).toEqual('buy')
    expect(message.actions!.trades[0].quantity).toEqual(10)
  })

  it('validates message with watchlist actions', () => {
    const message: ChatMessage = {
      id: '4',
      role: 'assistant',
      content: 'Adding GOOGL to watchlist',
      actions: {
        watchlist_changes: [{ ticker: 'GOOGL', action: 'add' }],
      },
      created_at: '2025-04-10T12:03:00Z',
    }

    expect(message.actions?.watchlist_changes).toBeDefined()
    expect(message.actions!.watchlist_changes).toHaveLength(1)
    expect(message.actions!.watchlist_changes[0].ticker).toEqual('GOOGL')
    expect(message.actions!.watchlist_changes[0].action).toEqual('add')
  })

  it('validates message with multiple trades', () => {
    const message: ChatMessage = {
      id: '5',
      role: 'assistant',
      content: 'Rebalancing portfolio',
      actions: {
        trades: [
          { ticker: 'TSLA', side: 'sell', quantity: 5 },
          { ticker: 'MSFT', side: 'buy', quantity: 3 },
        ],
        watchlist_changes: [{ ticker: 'NVDA', action: 'remove' }],
      },
      created_at: '2025-04-10T12:04:00Z',
    }

    expect(message.actions?.trades).toHaveLength(2)
    expect(message.actions?.watchlist_changes).toHaveLength(1)
    expect(message.actions!.trades[0].side).toEqual('sell')
    expect(message.actions!.trades[1].side).toEqual('buy')
    expect(message.actions!.watchlist_changes[0].action).toEqual('remove')
  })

  it('validates message without actions', () => {
    const message: ChatMessage = {
      id: '6',
      role: 'assistant',
      content: 'Just a regular message',
      created_at: '2025-04-10T12:05:00Z',
    }

    expect(message.actions).toBeUndefined()
  })

  it('validates role enum values', () => {
    const userMessage: ChatMessage = {
      id: '1',
      role: 'user',
      content: 'test',
      created_at: '2025-04-10T12:00:00Z',
    }

    const assistantMessage: ChatMessage = {
      id: '2',
      role: 'assistant',
      content: 'test',
      created_at: '2025-04-10T12:00:00Z',
    }

    expect(['user', 'assistant']).toContain(userMessage.role)
    expect(['user', 'assistant']).toContain(assistantMessage.role)
  })

  it('validates side enum values for trades', () => {
    const message: ChatMessage = {
      id: '1',
      role: 'assistant',
      content: 'test',
      actions: {
        trades: [
          { ticker: 'AAPL', side: 'buy', quantity: 5 },
          { ticker: 'GOOGL', side: 'sell', quantity: 3 },
        ],
      },
      created_at: '2025-04-10T12:00:00Z',
    }

    message.actions!.trades.forEach((trade) => {
      expect(['buy', 'sell']).toContain(trade.side)
    })
  })

  it('validates watchlist action enum values', () => {
    const message: ChatMessage = {
      id: '1',
      role: 'assistant',
      content: 'test',
      actions: {
        watchlist_changes: [
          { ticker: 'AAPL', action: 'add' },
          { ticker: 'GOOGL', action: 'remove' },
        ],
      },
      created_at: '2025-04-10T12:00:00Z',
    }

    message.actions!.watchlist_changes.forEach((change) => {
      expect(['add', 'remove']).toContain(change.action)
    })
  })
})
