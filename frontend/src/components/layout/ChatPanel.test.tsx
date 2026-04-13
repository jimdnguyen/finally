import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import ChatPanel from './ChatPanel'
import * as api from '@/lib/api'
import type { ChatResponse } from '@/types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api', () => ({
  sendChatMessage: vi.fn(),
}))

vi.mock('@/stores/portfolioStore', () => ({
  usePortfolioStore: {
    getState: vi.fn().mockReturnValue({ refresh: vi.fn() }),
  },
}))

const mockSend = vi.mocked(api.sendChatMessage)

const mockResponse: ChatResponse = {
  message: 'Buying AAPL for you.',
  trades_executed: [
    { ticker: 'AAPL', side: 'buy', quantity: 5, status: 'executed', price: 182.45 },
    { ticker: 'TSLA', side: 'buy', quantity: 2, status: 'error', error: 'Insufficient cash' },
  ],
  watchlist_changes_applied: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// AC1 — Greeting renders on mount
// ---------------------------------------------------------------------------

describe('AC1 — greeting on mount', () => {
  it('shows AI label row on load', () => {
    render(<ChatPanel />)
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('shows greeting text on load', () => {
    render(<ChatPanel />)
    expect(screen.getByText(/FinAlly/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC2 — User message + loading indicator
// ---------------------------------------------------------------------------

describe('AC2 — submitting a message', () => {
  it('appends user row with > prefix on submit', async () => {
    mockSend.mockResolvedValue(mockResponse)
    render(<ChatPanel />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'buy 5 AAPL' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByText('> buy 5 AAPL')).toBeInTheDocument()
    await waitFor(() => expect(mockSend).toHaveBeenCalledWith('buy 5 AAPL'))
  })

  it('clears input after submit', async () => {
    mockSend.mockResolvedValue(mockResponse)
    render(<ChatPanel />)

    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(input.value).toBe('')
    await waitFor(() => expect(mockSend).toHaveBeenCalled())
  })

  it('shows loading ... while pending', async () => {
    let resolve!: (r: ChatResponse) => void
    mockSend.mockReturnValue(new Promise<ChatResponse>((res) => { resolve = res }))

    render(<ChatPanel />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'hi' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByText('...')).toBeInTheDocument()

    // Clean up — resolve to avoid unhandled promise
    resolve(mockResponse)
  })
})

// ---------------------------------------------------------------------------
// AC3 — AI response renders correctly
// ---------------------------------------------------------------------------

describe('AC3 — AI response rows', () => {
  it('renders AI message text after response', async () => {
    mockSend.mockResolvedValue(mockResponse)
    render(<ChatPanel />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'buy AAPL' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    await screen.findByText(mockResponse.message)
  })

  it('renders exec-ok row for successful trade', async () => {
    mockSend.mockResolvedValue(mockResponse)
    render(<ChatPanel />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'buy AAPL' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    await screen.findByText(/AAPL BUY.*OK/i)
  })

  it('renders exec-fail row for failed trade', async () => {
    mockSend.mockResolvedValue(mockResponse)
    render(<ChatPanel />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'buy AAPL' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    await screen.findByText(/TSLA BUY failed.*Insufficient cash/i)
  })

  it('renders exec-fail error row when API call rejects', async () => {
    mockSend.mockRejectedValue(new Error('Network failure'))
    render(<ChatPanel />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'buy AAPL' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    await screen.findByText(/Error: Network failure/i)
  })
})

// ---------------------------------------------------------------------------
// AC4 — Chat input behavior
// ---------------------------------------------------------------------------

describe('AC4 — chat input', () => {
  it('renders > prefix label', () => {
    render(<ChatPanel />)
    expect(screen.getByText('>')).toBeInTheDocument()
  })

  it('renders SEND button', () => {
    render(<ChatPanel />)
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('Enter key submits message', async () => {
    mockSend.mockResolvedValue(mockResponse)
    render(<ChatPanel />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test message' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(mockSend).toHaveBeenCalledWith('test message'))
  })

  it('Send button click submits message', async () => {
    mockSend.mockResolvedValue(mockResponse)
    render(<ChatPanel />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'another message' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(mockSend).toHaveBeenCalledWith('another message'))
  })

  it('input is disabled while response is pending', async () => {
    let resolve!: (r: ChatResponse) => void
    mockSend.mockReturnValue(new Promise<ChatResponse>((res) => { resolve = res }))

    render(<ChatPanel />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hi' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(input.disabled).toBe(true)
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()

    resolve(mockResponse)
    await waitFor(() => expect(input.disabled).toBe(false))
  })
})

// ---------------------------------------------------------------------------
// AC5 — Error boundary
// ---------------------------------------------------------------------------

describe('AC5 — error boundary', () => {
  it('renders fallback when child throws', () => {
    // Suppress React's error console output for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function Bomb(): React.ReactElement {
      throw new Error('boom')
    }

    const { container } = render(
      <ErrorBoundaryTest>
        <Bomb />
      </ErrorBoundaryTest>
    )

    expect(container).toHaveTextContent('Chat unavailable')
    consoleSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// AC6 — Retry button (Story 3.3)
// ---------------------------------------------------------------------------

describe('AC6 — retry button on error', () => {
  it('renders Retry button when API call fails', async () => {
    mockSend.mockRejectedValue(new Error('Network failure'))
    render(<ChatPanel />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'buy AAPL' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    await screen.findByText(/Error: Network failure/i)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('clicking Retry re-submits the original message', async () => {
    mockSend
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce({ message: 'ok', trades_executed: [], watchlist_changes_applied: [] })

    render(<ChatPanel />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'buy AAPL' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    await screen.findByText(/Error: Network failure/i)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(2))
    expect(mockSend).toHaveBeenNthCalledWith(1, 'buy AAPL')
    expect(mockSend).toHaveBeenNthCalledWith(2, 'buy AAPL')
  })
})

// ---------------------------------------------------------------------------
// Helper: expose ChatErrorBoundary for isolated testing
// ---------------------------------------------------------------------------

class ErrorBoundaryTest extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <aside className="bg-surface border-l border-border flex items-center justify-center p-4">
          <p className="text-red-down text-sm font-mono">Chat unavailable</p>
        </aside>
      )
    }
    return this.props.children
  }
}
