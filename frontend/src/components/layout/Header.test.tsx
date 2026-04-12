import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Header from './Header'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePriceStore } from '@/stores/priceStore'

vi.mock('./StatusDot', () => ({
  default: () => <div data-testid="status-dot" />,
}))

beforeEach(() => {
  usePortfolioStore.setState({ portfolio: null, isLoading: false })
  usePriceStore.setState({ prices: {}, sparklines: {}, connectionStatus: 'disconnected', selectedTicker: 'AAPL' })
})

describe('Header', () => {
  it('renders brand logo in accent-yellow', () => {
    const { container } = render(<Header />)
    const brand = screen.getByText('FinAlly')
    expect(brand).toBeTruthy()
    expect(brand.className).toContain('text-accent-yellow')
  })

  it('renders StatusDot', () => {
    render(<Header />)
    expect(screen.getByTestId('status-dot')).toBeTruthy()
  })

  it('shows placeholder when portfolio is null', () => {
    render(<Header />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBe(2) // total value + cash
  })

  it('shows portfolio value and cash balance from store', () => {
    usePortfolioStore.setState({
      portfolio: { cash_balance: 8500, total_value: 10500, positions: [] },
    })
    render(<Header />)
    expect(screen.getByText('$10,500.00')).toBeTruthy()
    expect(screen.getByText('$8,500.00')).toBeTruthy()
  })
})
