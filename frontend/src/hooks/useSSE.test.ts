import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePriceStore } from '@/stores/priceStore'
import { useSSE } from './useSSE'

// --- Mock EventSource ---
type EventSourceHandlers = {
  onopen: (() => void) | null
  onmessage: ((e: { data: string }) => void) | null
  onerror: (() => void) | null
}

let mockES: EventSourceHandlers & { close: ReturnType<typeof vi.fn> }

class MockEventSource {
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn()

  constructor() {
    mockES = this as typeof mockES
  }
}

beforeEach(() => {
  vi.stubGlobal('EventSource', MockEventSource)
  usePriceStore.setState({ prices: {}, sparklines: {}, connectionStatus: 'disconnected' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useSSE', () => {
  it('onopen sets connectionStatus to connected', () => {
    renderHook(() => useSSE())
    act(() => {
      mockES.onopen?.()
    })
    expect(usePriceStore.getState().connectionStatus).toBe('connected')
  })

  it('onmessage parses batch payload and calls updatePrice for each ticker', () => {
    renderHook(() => useSSE())
    const batch = {
      AAPL: { ticker: 'AAPL', price: 191, previous_price: 190, timestamp: 'ts', direction: 'up', change: 1, change_percent: 0.5 },
      GOOGL: { ticker: 'GOOGL', price: 175, previous_price: 174, timestamp: 'ts', direction: 'up', change: 1, change_percent: 0.6 },
    }
    act(() => {
      mockES.onmessage?.({ data: JSON.stringify(batch) })
    })
    const { prices } = usePriceStore.getState()
    expect(prices['AAPL'].price).toBe(191)
    expect(prices['GOOGL'].price).toBe(175)
  })

  it('onerror sets connectionStatus to reconnecting', () => {
    vi.useFakeTimers()
    renderHook(() => useSSE())
    act(() => {
      mockES.onerror?.()
    })
    expect(usePriceStore.getState().connectionStatus).toBe('reconnecting')
  })

  it('cleanup calls EventSource.close on unmount', () => {
    const { unmount } = renderHook(() => useSSE())
    unmount()
    expect(mockES.close).toHaveBeenCalledOnce()
  })
})
