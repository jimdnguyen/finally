'use client'

import { usePortfolioStore } from '@/stores/portfolioStore'
import StatusDot from './StatusDot'

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export default function Header() {
  const portfolio = usePortfolioStore((s) => s.portfolio)

  return (
    <header className="h-12 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0">
      <h1 className="font-mono text-accent-yellow font-semibold tracking-wide">
        FinAlly
      </h1>
      <div className="flex items-center gap-4">
        <div aria-live="polite" aria-label={`Portfolio total value: ${portfolio ? currencyFmt.format(portfolio.total_value) : 'loading'}`}>
          <span className="font-mono text-lg font-semibold" role="status">
            {portfolio ? currencyFmt.format(portfolio.total_value) : '—'}
          </span>
        </div>
        <div aria-live="polite" aria-label={`Available cash: ${portfolio ? currencyFmt.format(portfolio.cash_balance) : 'loading'}`}>
          <span className="font-sans text-xs text-text-muted">
            Cash:{' '}
            <span data-testid="cash-balance" className="font-mono text-sm font-medium text-text-muted" role="status">
              {portfolio ? currencyFmt.format(portfolio.cash_balance) : '—'}
            </span>
          </span>
        </div>
      </div>
      <StatusDot />
    </header>
  )
}
