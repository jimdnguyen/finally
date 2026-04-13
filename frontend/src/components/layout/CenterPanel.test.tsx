import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import CenterPanel from './CenterPanel'
import { usePriceStore } from '@/stores/priceStore'

// Mock MainChart to avoid LightweightCharts complexity
vi.mock('./MainChart', () => ({
  default: () => <div data-testid="main-chart" />,
}))

vi.mock('./TradeBar', () => ({
  default: () => <div data-testid="trade-bar" />,
}))

vi.mock('./PositionsTable', () => ({
  default: () => <div data-testid="positions-table" />,
}))

vi.mock('./PortfolioHeatmap', () => ({
  default: () => <div data-testid="portfolio-heatmap" />,
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

  it('renders TradeBar component', () => {
    const { getByTestId } = render(<CenterPanel />)
    expect(getByTestId('trade-bar')).toBeTruthy()
  })

  it('renders PositionsTable component', () => {
    const { getByTestId } = render(<CenterPanel />)
    expect(getByTestId('positions-table')).toBeTruthy()
  })

  it('wraps PositionsTable in a scrollable container', () => {
    const { getByTestId } = render(<CenterPanel />)
    const wrapper = getByTestId('positions-table').parentElement
    expect(wrapper?.className).toContain('overflow-auto')
  })

  it('renders PortfolioHeatmap component', () => {
    const { getByTestId } = render(<CenterPanel />)
    expect(getByTestId('portfolio-heatmap')).toBeTruthy()
  })

  it('wraps heatmap and positions in a bottom panel with border-t', () => {
    const { getByTestId } = render(<CenterPanel />)
    const bottomPanel = getByTestId('portfolio-heatmap').parentElement?.parentElement
    expect(bottomPanel?.className).toContain('border-t')
    expect(bottomPanel?.className).toContain('border-border')
  })
})
