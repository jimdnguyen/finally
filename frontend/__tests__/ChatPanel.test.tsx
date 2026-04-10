import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ChatPanel } from '@/components/chat/ChatPanel'

// Mock the hooks
vi.mock('@/hooks/useChatMessages', () => ({
  useChatMessages: vi.fn(() => ({
    data: [
      {
        id: '1',
        role: 'user',
        content: 'What should I buy?',
        created_at: '2025-04-10T12:00:00Z',
      },
      {
        id: '2',
        role: 'assistant',
        content: 'I recommend AAPL',
        actions: {
          trades: [{ ticker: 'AAPL', side: 'buy', quantity: 10 }],
        },
        created_at: '2025-04-10T12:01:00Z',
      },
    ],
    isLoading: false,
  })),
}))

vi.mock('@/hooks/useChatMutation', () => ({
  useChatMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
)

describe('ChatPanel', () => {
  it('renders chat messages', () => {
    render(<ChatPanel />, { wrapper })
    expect(screen.getByText('What should I buy?')).toBeInTheDocument()
    expect(screen.getByText('I recommend AAPL')).toBeInTheDocument()
  })

  it('displays loading state', () => {
    const { useChatMessages } = await import('@/hooks/useChatMessages')
    vi.mocked(useChatMessages).mockReturnValue({
      data: [],
      isLoading: true,
    } as any)

    render(<ChatPanel />, { wrapper })
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('sends message on Enter key', async () => {
    const user = userEvent.setup()
    const { useChatMutation } = await import('@/hooks/useChatMutation')
    const mockMutate = vi.fn()
    vi.mocked(useChatMutation).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any)

    render(<ChatPanel />, { wrapper })

    const input = screen.getByPlaceholderText('Ask me...')
    await user.type(input, 'Buy TSLA{Enter}')

    expect(mockMutate).toHaveBeenCalledWith({ message: 'Buy TSLA' })
  })

  it('disables input during pending mutation', () => {
    const { useChatMutation } = await import('@/hooks/useChatMutation')
    vi.mocked(useChatMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    } as any)

    render(<ChatPanel />, { wrapper })
    const input = screen.getByPlaceholderText('Ask me...')
    expect(input).toBeDisabled()
  })

  it('shows thinking indicator during mutation', () => {
    const { useChatMutation } = await import('@/hooks/useChatMutation')
    vi.mocked(useChatMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    } as any)

    render(<ChatPanel />, { wrapper })
    expect(screen.getByText('Thinking...')).toBeInTheDocument()
  })
})
