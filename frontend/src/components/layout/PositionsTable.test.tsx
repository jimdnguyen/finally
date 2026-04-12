import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PositionsTable from './PositionsTable'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePriceStore } from '@/stores/priceStore'
import type { Portfolio } from '@/types'

const mockPortfolio: Portfolio = {
  cash_balance: 8500,
  total_value: 10500,
  positions: [
    { ticker: 'AAPL', quantity: 10, avg_cost: 150, current_price: 200, unrealized_pnl: 500, pnl_pct: 33.33 },
    { ticker: 'TSLA', quantity: 5, avg_cost: 300, current_price: 250, unrealized_pnl: -250, pnl_pct: -16.67 },
  ],
}

beforeEach(() => {
  usePortfolioStore.setState({ portfolio: null, isLoading: false })
  usePriceStore.setState({ prices: {}, sparklines: {}, connectionStatus: 'disconnected', selectedTicker: 'AAPL' })
})

describe('PositionsTable', () => {
  it('renders empty state when no positions', () => {
    usePortfolioStore.setState({ portfolio: { cash_balance: 10000, total_value: 10000, positions: [] } })
    render(<PositionsTable />)
    expect(screen.getByText('No positions — buy something to get started')).toBeTruthy()
  })

  it('renders empty state when portfolio is null', () => {
    render(<PositionsTable />)
    expect(screen.getByText('No positions — buy something to get started')).toBeTruthy()
  })

  it('renders all columns with correct data', () => {
    usePortfolioStore.setState({ portfolio: mockPortfolio })
    render(<PositionsTable />)

    // Column headers
    expect(screen.getByText('Ticker')).toBeTruthy()
    expect(screen.getByText('Qty')).toBeTruthy()
    expect(screen.getByText('Avg Cost')).toBeTruthy()
    expect(screen.getByText('Price')).toBeTruthy()
    expect(screen.getByText('P&L')).toBeTruthy()
    expect(screen.getByText('%')).toBeTruthy()

    // AAPL row
    expect(screen.getByText('AAPL')).toBeTruthy()
    expect(screen.getByText('$150.00')).toBeTruthy()
    expect(screen.getByText('$200.00')).toBeTruthy()
  })

  it('shows positive P&L with + prefix and green color', () => {
    usePortfolioStore.setState({ portfolio: mockPortfolio })
    const { container } = render(<PositionsTable />)

    // AAPL has positive P&L: (200 - 150) * 10 = 500
    const greenCells = container.querySelectorAll('.text-green-up')
    expect(greenCells.length).toBeGreaterThanOrEqual(2) // P&L cell + % cell
    expect(screen.getByText('+$500.00')).toBeTruthy()
    expect(screen.getByText('+33.33%')).toBeTruthy()
  })

  it('shows negative P&L with U+2212 minus and red color', () => {
    usePortfolioStore.setState({ portfolio: mockPortfolio })
    const { container } = render(<PositionsTable />)

    // TSLA has negative P&L: (250 - 300) * 5 = -250
    const redCells = container.querySelectorAll('.text-red-down')
    expect(redCells.length).toBeGreaterThanOrEqual(2) // P&L cell + % cell
    expect(screen.getByText('\u2212$250.00')).toBeTruthy()
    expect(screen.getByText('\u221216.67%')).toBeTruthy()
  })

  it('uses live price from priceStore when available', () => {
    usePortfolioStore.setState({ portfolio: mockPortfolio })
    usePriceStore.setState({
      prices: {
        AAPL: {
          ticker: 'AAPL', price: 210, previous_price: 200,
          timestamp: new Date().toISOString(), direction: 'up', change: 10, change_percent: 5,
        },
      },
      sparklines: {},
      connectionStatus: 'connected',
      selectedTicker: 'AAPL',
    })
    render(<PositionsTable />)

    // AAPL should show $210.00 (live) not $200.00 (stale)
    expect(screen.getByText('$210.00')).toBeTruthy()
    // P&L: (210 - 150) * 10 = 600
    expect(screen.getByText('+$600.00')).toBeTruthy()
    // Pct: ((210 - 150) / 150) * 100 = 40
    expect(screen.getByText('+40.00%')).toBeTruthy()
  })

  it('uses font-mono for numeric cells', () => {
    usePortfolioStore.setState({ portfolio: mockPortfolio })
    const { container } = render(<PositionsTable />)
    const tds = container.querySelectorAll('td')
    // All td cells should have font-mono
    tds.forEach((td) => {
      expect(td.className).toContain('font-mono')
    })
  })
})
