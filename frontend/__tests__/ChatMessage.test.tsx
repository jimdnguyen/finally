import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatMessage } from '@/components/chat/ChatMessage'
import type { ChatMessage as ChatMessageType } from '@/hooks/useChatMessages'

describe('ChatMessage', () => {
  it('renders user message with user styling', () => {
    const message: ChatMessageType = {
      id: '1',
      role: 'user',
      content: 'What is my portfolio?',
      created_at: '2025-04-10T12:00:00Z',
    }

    render(<ChatMessage message={message} />)
    expect(screen.getByText('What is my portfolio?')).toBeInTheDocument()
    const msgElement = screen.getByText('What is my portfolio?').closest('div')
    expect(msgElement).toHaveClass('bg-blue-primary')
  })

  it('renders assistant message with assistant styling', () => {
    const message: ChatMessageType = {
      id: '2',
      role: 'assistant',
      content: 'Your portfolio is worth $12,500',
      created_at: '2025-04-10T12:01:00Z',
    }

    render(<ChatMessage message={message} />)
    expect(screen.getByText('Your portfolio is worth $12,500')).toBeInTheDocument()
    const msgElement = screen.getByText('Your portfolio is worth $12,500').closest('div')
    expect(msgElement).toHaveClass('bg-gray-700')
  })

  it('displays inline trade confirmations', () => {
    const message: ChatMessageType = {
      id: '3',
      role: 'assistant',
      content: 'Buying AAPL',
      actions: {
        trades: [{ ticker: 'AAPL', side: 'buy', quantity: 10 }],
      },
      created_at: '2025-04-10T12:02:00Z',
    }

    render(<ChatMessage message={message} />)
    expect(screen.getByText('BUY 10 AAPL')).toBeInTheDocument()
  })

  it('displays inline watchlist confirmations', () => {
    const message: ChatMessageType = {
      id: '4',
      role: 'assistant',
      content: 'Adding GOOGL to watchlist',
      actions: {
        watchlist_changes: [{ ticker: 'GOOGL', action: 'add' }],
      },
      created_at: '2025-04-10T12:03:00Z',
    }

    render(<ChatMessage message={message} />)
    expect(screen.getByText('GOOGL')).toBeInTheDocument()
  })

  it('displays both trades and watchlist changes', () => {
    const message: ChatMessageType = {
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

    render(<ChatMessage message={message} />)
    expect(screen.getByText('SELL 5 TSLA')).toBeInTheDocument()
    expect(screen.getByText('BUY 3 MSFT')).toBeInTheDocument()
    expect(screen.getByText('NVDA')).toBeInTheDocument()
  })
})
