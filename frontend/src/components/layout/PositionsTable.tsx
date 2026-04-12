'use client'

import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePriceStore } from '@/stores/priceStore'
import type { Position } from '@/types'

const EMPTY_POSITIONS: Position[] = []

function formatPnl(value: number): { text: string; className: string } {
  if (value === 0) return { text: '$0.00', className: 'text-text-muted' }
  const sign = value > 0 ? '+' : '\u2212'
  const color = value > 0 ? 'text-green-up' : 'text-red-down'
  return { text: `${sign}$${Math.abs(value).toFixed(2)}`, className: color }
}

function formatPct(value: number): { text: string; className: string } {
  if (value === 0) return { text: '0.00%', className: 'text-text-muted' }
  const sign = value > 0 ? '+' : '\u2212'
  const color = value > 0 ? 'text-green-up' : 'text-red-down'
  return { text: `${sign}${Math.abs(value).toFixed(2)}%`, className: color }
}

function PositionRow({ position }: { position: Position }) {
  const livePrice = usePriceStore((s) => s.prices[position.ticker]?.price)
  const displayPrice = livePrice ?? position.current_price
  const unrealizedPnl = (displayPrice - position.avg_cost) * position.quantity
  const pnlPct = position.avg_cost !== 0
    ? ((displayPrice - position.avg_cost) / position.avg_cost) * 100
    : 0

  const pnl = formatPnl(unrealizedPnl)
  const pct = formatPct(pnlPct)

  return (
    <tr className="border-b border-border hover:bg-surface/50">
      <td className="px-3 py-2 font-mono text-sm font-semibold">{position.ticker}</td>
      <td className="px-3 py-2 font-mono text-sm text-right">{position.quantity}</td>
      <td className="px-3 py-2 font-mono text-sm text-right">${position.avg_cost.toFixed(2)}</td>
      <td className="px-3 py-2 font-mono text-sm text-right">${displayPrice.toFixed(2)}</td>
      <td className={`px-3 py-2 font-mono text-sm text-right ${pnl.className}`}>{pnl.text}</td>
      <td className={`px-3 py-2 font-mono text-sm text-right ${pct.className}`}>{pct.text}</td>
    </tr>
  )
}

export default function PositionsTable() {
  const positions = usePortfolioStore((s) => s.portfolio?.positions ?? EMPTY_POSITIONS)

  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No positions — buy something to get started
      </div>
    )
  }

  return (
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-border">
          <th className="px-3 py-1.5 font-sans text-xs text-text-muted font-medium">Ticker</th>
          <th className="px-3 py-1.5 font-sans text-xs text-text-muted font-medium text-right">Qty</th>
          <th className="px-3 py-1.5 font-sans text-xs text-text-muted font-medium text-right">Avg Cost</th>
          <th className="px-3 py-1.5 font-sans text-xs text-text-muted font-medium text-right">Price</th>
          <th className="px-3 py-1.5 font-sans text-xs text-text-muted font-medium text-right">P&L</th>
          <th className="px-3 py-1.5 font-sans text-xs text-text-muted font-medium text-right">%</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((pos) => (
          <PositionRow key={pos.ticker} position={pos} />
        ))}
      </tbody>
    </table>
  )
}
