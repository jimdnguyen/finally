'use client'

import { usePortfolioStore } from '@/stores/portfolioStore'
import StatusDot from './StatusDot'

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export default function Header() {
  const portfolio = usePortfolioStore((s) => s.portfolio)

  return (
    <header className="h-12 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0">
      <span className="font-mono text-accent-yellow font-semibold tracking-wide">
        FinAlly
      </span>
      <div className="flex items-center gap-4">
        <span className="font-mono text-lg font-semibold">
          {portfolio ? currencyFmt.format(portfolio.total_value) : '—'}
        </span>
        <span className="font-sans text-xs text-text-muted">
          Cash:{' '}
          <span data-testid="cash-balance" className="font-mono text-sm font-medium text-text-muted">
            {portfolio ? currencyFmt.format(portfolio.cash_balance) : '—'}
          </span>
        </span>
      </div>
      <StatusDot />
    </header>
  )
}
