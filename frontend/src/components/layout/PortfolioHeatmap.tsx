'use client'

import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePriceStore } from '@/stores/priceStore'
import type { Position } from '@/types'

const EMPTY_POSITIONS: Position[] = []

function interpolateColor(pnlPct: number): string {
  const maxPct = 20
  const t = Math.min(Math.abs(pnlPct) / maxPct, 1)
  const neutral = [45, 51, 59]
  const target = pnlPct >= 0 ? [63, 185, 80] : [248, 81, 73]
  const r = Math.round(neutral[0] + (target[0] - neutral[0]) * t)
  const g = Math.round(neutral[1] + (target[1] - neutral[1]) * t)
  const b = Math.round(neutral[2] + (target[2] - neutral[2]) * t)
  return `rgb(${r}, ${g}, ${b})`
}

function formatSign(value: number): string {
  return value >= 0 ? '+' : '\u2212'
}

function HeatmapCell({ position, weightPct }: { position: Position; weightPct: number }) {
  const livePrice = usePriceStore((s) => s.prices[position.ticker]?.price)
  const displayPrice = livePrice ?? position.current_price
  const pnlPct = position.avg_cost !== 0
    ? ((displayPrice - position.avg_cost) / position.avg_cost) * 100
    : 0

  const sign = formatSign(pnlPct)
  const label = `${position.ticker} ${sign}${Math.abs(pnlPct).toFixed(2)}%`

  return (
    <div
      data-testid={`heatmap-cell-${position.ticker}`}
      aria-label={label}
      className="flex flex-col items-center justify-center min-w-[60px] p-2 cursor-default"
      style={{
        flexBasis: `${weightPct.toFixed(2)}%`,
        backgroundColor: interpolateColor(pnlPct),
      }}
    >
      <span className="text-xs font-semibold text-text-primary">{position.ticker}</span>
      <span className="text-xs font-mono text-text-primary">
        {sign}{Math.abs(pnlPct).toFixed(2)}%
      </span>
    </div>
  )
}

export default function PortfolioHeatmap() {
  const positions = usePortfolioStore((s) => s.portfolio?.positions ?? EMPTY_POSITIONS)
  const prices = usePriceStore((s) => s.prices)

  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No positions — buy something to get started
      </div>
    )
  }

  const positionValues = positions.map((pos) => {
    const livePrice = prices[pos.ticker]?.price ?? pos.current_price
    return livePrice * pos.quantity
  })
  const totalValue = positionValues.reduce((sum, v) => sum + v, 0)

  return (
    <div className="flex flex-wrap min-h-0 h-full overflow-hidden">
      {positions.map((pos, i) => {
        const weightPct = totalValue > 0 ? (positionValues[i] / totalValue) * 100 : 0
        return <HeatmapCell key={pos.ticker} position={pos} weightPct={weightPct} />
      })}
    </div>
  )
}
