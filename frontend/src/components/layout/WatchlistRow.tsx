'use client'

import { useEffect, useRef } from 'react'
import { usePriceStore } from '@/stores/priceStore'
import SparklineChart from './SparklineChart'
import type { SparklinePoint } from '@/stores/priceStore'

const EMPTY_POINTS: SparklinePoint[] = []

interface WatchlistRowProps {
  ticker: string
}

function formatChange(price: number, prev: number): { text: string; positive: boolean } {
  if (prev === 0) return { text: '—', positive: true }
  const pct = ((price - prev) / prev) * 100
  const sign = pct >= 0 ? '+' : '\u2212'
  return { text: `${sign}${Math.abs(pct).toFixed(2)}%`, positive: pct >= 0 }
}

export default function WatchlistRow({ ticker }: WatchlistRowProps) {
  const price = usePriceStore((s) => s.prices[ticker])
  const points = usePriceStore((s) => s.sparklines[ticker] ?? EMPTY_POINTS)
  const isActive = usePriceStore((s) => s.selectedTicker === ticker)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!price || !rowRef.current) return
    const el = rowRef.current
    el.classList.remove('flash-green', 'flash-red')
    // Force reflow so removing + re-adding the class restarts the animation
    void el.offsetWidth
    el.classList.add(price.price >= price.previous_price ? 'flash-green' : 'flash-red')
    const timer = setTimeout(() => {
      el.classList.remove('flash-green', 'flash-red')
    }, 500)
    return () => clearTimeout(timer)
  }, [price?.price])

  const change = price ? formatChange(price.price, price.previous_price) : null

  return (
    <div
      ref={rowRef}
      onClick={() => usePriceStore.getState().selectTicker(ticker)}
      className={`flex items-center gap-2 px-3 py-2 border-b border-b-border cursor-pointer hover:bg-surface border-l-2 ${
        isActive ? 'border-l-blue-primary' : 'border-l-transparent'
      }`}
    >
      <span className="w-14 text-xs font-semibold text-text-primary uppercase">{ticker}</span>
      <SparklineChart points={points} />
      <span className="font-mono text-xs text-text-primary ml-auto">
        {price ? `$${price.price.toFixed(2)}` : '—'}
      </span>
      <span
        className={`font-mono text-xs w-16 text-right ${
          change
            ? change.positive
              ? 'text-green-up'
              : 'text-red-down'
            : 'text-text-muted'
        }`}
      >
        {change ? change.text : '—'}
      </span>
    </div>
  )
}
