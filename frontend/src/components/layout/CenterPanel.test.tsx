import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import CenterPanel from './CenterPanel'
import { usePriceStore } from '@/stores/priceStore'

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

vi.mock('./PnLHistoryChart', () => ({
  default: () => <div data-testid="pnl-history-chart" />,
}))

vi.mock('./TabStrip', () => ({
  default: ({ tabs, activeTab, onTabChange }: { tabs: string[]; activeTab: string; onTabChange: (t: string) => void }) => (
    <div data-testid="tab-strip">
      {tabs.map((t) => (
        <button key={t} data-testid={`tab-${t}`} data-active={t === activeTab} onClick={() => onTabChange(t)}>
          {t}
        </button>
      ))}
    </div>
  ),
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

  it('renders TabStrip component', () => {
    const { getByTestId } = render(<CenterPanel />)
    expect(getByTestId('tab-strip')).toBeTruthy()
  })

  it('default tab is Positions — PositionsTable visible', () => {
    const { getByTestId, queryByTestId } = render(<CenterPanel />)
    expect(getByTestId('positions-table')).toBeTruthy()
    expect(queryByTestId('portfolio-heatmap')).toBeNull()
    expect(queryByTestId('pnl-history-chart')).toBeNull()
  })

  it('switching to Heatmap shows PortfolioHeatmap', () => {
    const { getByTestId, queryByTestId } = render(<CenterPanel />)
    fireEvent.click(getByTestId('tab-Heatmap'))
    expect(getByTestId('portfolio-heatmap')).toBeTruthy()
    expect(queryByTestId('positions-table')).toBeNull()
    expect(queryByTestId('pnl-history-chart')).toBeNull()
  })

  it('switching to P&L History shows PnLHistoryChart', () => {
    const { getByTestId, queryByTestId } = render(<CenterPanel />)
    fireEvent.click(getByTestId('tab-P&L History'))
    expect(getByTestId('pnl-history-chart')).toBeTruthy()
    expect(queryByTestId('positions-table')).toBeNull()
    expect(queryByTestId('portfolio-heatmap')).toBeNull()
  })

  it('has border-t above TabStrip area', () => {
    const { getByTestId } = render(<CenterPanel />)
    const tabStripWrapper = getByTestId('tab-strip').parentElement
    expect(tabStripWrapper?.className).toContain('border-t')
    expect(tabStripWrapper?.className).toContain('border-border')
  })
})
