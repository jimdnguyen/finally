'use client'

import { useEffect, useRef, useState } from 'react'
import { usePriceStore } from '@/stores/priceStore'
import { useWatchlistStore } from '@/stores/watchlistStore'
import { removeFromWatchlist, fetchWatchlist } from '@/lib/api'
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
  const [isRemoving, setIsRemoving] = useState(false)

  useEffect(() => {
    if (!price || !rowRef.current) return
    const el = rowRef.current
    el.classList.remove('flash-green', 'flash-red')
    void el.offsetWidth
    el.classList.add(price.price >= price.previous_price ? 'flash-green' : 'flash-red')
    const timer = setTimeout(() => {
      el.classList.remove('flash-green', 'flash-red')
    }, 500)
    return () => clearTimeout(timer)
  }, [price?.price])

  const change = price ? formatChange(price.price, price.previous_price) : null

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation()
    if (isRemoving) return
    setIsRemoving(true)
    try {
      await removeFromWatchlist(ticker)
      const items = await fetchWatchlist()
      useWatchlistStore.getState().setTickers(items.map((i) => i.ticker))
    } catch {
      // Refetch anyway to stay in sync — but don't wipe store if refetch also fails
      const items = await fetchWatchlist().catch(() => null)
      if (items) useWatchlistStore.getState().setTickers(items.map((i) => i.ticker))
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div
      ref={rowRef}
      onClick={() => usePriceStore.getState().selectTicker(ticker)}
      className={`group grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-2 px-2 py-1.5 border-b border-b-border cursor-pointer hover:bg-surface border-l-2 ${
        isActive ? 'border-l-blue-primary' : 'border-l-transparent'
      }`}
    >
      <span className="text-xs font-semibold text-text-primary uppercase truncate">{ticker}</span>
      <div className="flex justify-center">
        <SparklineChart points={points} width={44} />
      </div>
      <div className="flex flex-col items-end">
        <span className="font-mono text-xs text-text-primary">
          {price ? `$${price.price.toFixed(2)}` : '—'}
        </span>
        <span
          className={`font-mono text-[10px] leading-tight ${
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
      <button
        onClick={handleRemove}
        disabled={isRemoving}
        className="hidden group-hover:block col-start-3 text-red-down text-xs font-semibold hover:text-red-600 disabled:opacity-40"
        aria-label={`Remove ${ticker}`}
      >
        ×
      </button>
    </div>
  )
}
