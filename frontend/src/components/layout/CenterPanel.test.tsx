import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import CenterPanel from './CenterPanel'
import { usePriceStore } from '@/stores/priceStore'

// Mock MainChart to avoid LightweightCharts complexity
vi.mock('./MainChart', () => ({
  default: () => <div data-testid="main-chart" />,
}))

beforeEach(() => {
  usePriceStore.setState({
    prices: {},
    sparklines: {},
    connectionStatus: 'disconnected',
    selectedTicker: 'AAPL',
  })
})

describe('CenterPanel', () => {
  it('renders MainChart component', () => {
    const { getByTestId } = render(<CenterPanel />)
    expect(getByTestId('main-chart')).toBeTruthy()
  })

  it('wraps MainChart in a flex-1 min-h-0 container', () => {
    const { getByTestId } = render(<CenterPanel />)
    const wrapper = getByTestId('main-chart').parentElement
    expect(wrapper?.className).toContain('flex-1')
    expect(wrapper?.className).toContain('min-h-0')
  })
})
