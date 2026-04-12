import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePriceStore } from '@/stores/priceStore'
import StatusDot from './StatusDot'

beforeEach(() => {
  usePriceStore.setState({ prices: {}, sparklines: {}, connectionStatus: 'disconnected' })
})

describe('StatusDot', () => {
  it('renders green dot with LIVE when connected', () => {
    usePriceStore.setState({ connectionStatus: 'connected' })
    render(<StatusDot />)
    expect(screen.getByText('LIVE')).toBeInTheDocument()
    const dot = screen.getByText('LIVE').previousElementSibling
    expect(dot?.className).toContain('bg-green-up')
  })

  it('renders yellow dot with RECONNECTING and pulse class when reconnecting', () => {
    usePriceStore.setState({ connectionStatus: 'reconnecting' })
    render(<StatusDot />)
    expect(screen.getByText('RECONNECTING')).toBeInTheDocument()
    const dot = screen.getByText('RECONNECTING').previousElementSibling
    expect(dot?.className).toContain('bg-accent-yellow')
    expect(dot?.className).toContain('animate-pulse')
  })

  it('renders red dot with DISCONNECTED when disconnected', () => {
    usePriceStore.setState({ connectionStatus: 'disconnected' })
    render(<StatusDot />)
    expect(screen.getByText('DISCONNECTED')).toBeInTheDocument()
    const dot = screen.getByText('DISCONNECTED').previousElementSibling
    expect(dot?.className).toContain('bg-red-down')
  })
})
