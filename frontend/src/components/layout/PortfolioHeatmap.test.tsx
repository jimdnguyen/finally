import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PortfolioHeatmap from './PortfolioHeatmap'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePriceStore } from '@/stores/priceStore'

beforeEach(() => {
  usePortfolioStore.setState({ portfolio: null })
  usePriceStore.setState({ prices: {} })
})

describe('PortfolioHeatmap empty state', () => {
  it('shows empty message when portfolio is null', () => {
    render(<PortfolioHeatmap />)
    expect(screen.getByText('No positions — buy something to get started')).toBeTruthy()
  })

  it('shows empty message when positions array is empty', () => {
    usePortfolioStore.setState({
      portfolio: { cash_balance: 10000, positions: [], total_value: 10000 },
    })
    render(<PortfolioHeatmap />)
    expect(screen.getByText('No positions — buy something to get started')).toBeTruthy()
  })
})

describe('PortfolioHeatmap cell rendering', () => {
  const twoPositions = {
    cash_balance: 0,
    positions: [
      { ticker: 'AAPL', quantity: 10, avg_cost: 150, current_price: 180, unrealized_pnl: 300, pnl_pct: 20 },
      { ticker: 'TSLA', quantity: 5, avg_cost: 200, current_price: 160, unrealized_pnl: -200, pnl_pct: -20 },
    ],
    total_value: 2600,
  }

  it('renders one cell per position', () => {
    usePortfolioStore.setState({ portfolio: twoPositions })
    render(<PortfolioHeatmap />)
    expect(screen.getByText('AAPL')).toBeTruthy()
    expect(screen.getByText('TSLA')).toBeTruthy()
  })

  it('sets flex-basis proportional to position weight', () => {
    usePortfolioStore.setState({ portfolio: twoPositions })
    const { container } = render(<PortfolioHeatmap />)
    const cells = container.querySelectorAll('[data-testid^="heatmap-cell-"]')
    expect(cells).toHaveLength(2)

    // AAPL: 10 * 180 = 1800, TSLA: 5 * 160 = 800, total = 2600
    // AAPL weight = 1800/2600 ≈ 69.23%, TSLA weight = 800/2600 ≈ 30.77%
    const aaplBasis = (cells[0] as HTMLElement).style.flexBasis
    const tslaBasis = (cells[1] as HTMLElement).style.flexBasis
    expect(parseFloat(aaplBasis)).toBeCloseTo(69.23, 0)
    expect(parseFloat(tslaBasis)).toBeCloseTo(30.77, 0)
  })

  it('shows positive P&L with + prefix in aria-label', () => {
    usePortfolioStore.setState({ portfolio: twoPositions })
    render(<PortfolioHeatmap />)
    const aaplCell = screen.getByLabelText(/AAPL \+/)
    expect(aaplCell).toBeTruthy()
  })

  it('shows negative P&L with − (U+2212) prefix in aria-label', () => {
    usePortfolioStore.setState({ portfolio: twoPositions })
    render(<PortfolioHeatmap />)
    const tslaCell = screen.getByLabelText(/TSLA \u2212/)
    expect(tslaCell).toBeTruthy()
  })
})

describe('PortfolioHeatmap live price updates', () => {
  it('recalculates weight and P&L when priceStore updates', () => {
    usePortfolioStore.setState({
      portfolio: {
        cash_balance: 0,
        positions: [
          { ticker: 'AAPL', quantity: 10, avg_cost: 100, current_price: 100, unrealized_pnl: 0, pnl_pct: 0 },
          { ticker: 'MSFT', quantity: 10, avg_cost: 100, current_price: 100, unrealized_pnl: 0, pnl_pct: 0 },
        ],
        total_value: 2000,
      },
    })

    // Set live price: AAPL jumps to 200, MSFT stays at 100
    usePriceStore.setState({
      prices: {
        AAPL: { ticker: 'AAPL', price: 200, previous_price: 100, timestamp: '', direction: 'up' as const, change: 100, change_percent: 100 },
      },
    })

    const { container } = render(<PortfolioHeatmap />)
    const cells = container.querySelectorAll('[data-testid^="heatmap-cell-"]')

    // AAPL: 10 * 200 = 2000, MSFT: 10 * 100 = 1000, total = 3000
    // AAPL weight ≈ 66.67%, MSFT weight ≈ 33.33%
    const aaplBasis = (cells[0] as HTMLElement).style.flexBasis
    expect(parseFloat(aaplBasis)).toBeCloseTo(66.67, 0)

    // AAPL P&L = +100% → aria-label should show +100.00%
    const aaplCell = screen.getByLabelText(/AAPL \+100\.00%/)
    expect(aaplCell).toBeTruthy()
  })
})
