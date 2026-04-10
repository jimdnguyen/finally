'use client'

import { useEffect, useState } from 'react'
import { usePriceStore } from '@/store/priceStore'
import { Sparkline } from './Sparkline'

interface WatchlistRowProps {
  ticker: string
  onSelect: () => void
}

export function WatchlistRow({ ticker, onSelect }: WatchlistRowProps) {
  const price = usePriceStore((s) => s.prices[ticker])
  const history = usePriceStore((s) => s.history[ticker])
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  // Price flash animation (re-run only when price.price changes)
  useEffect(() => {
    if (!price) return

    const direction = price.direction === 'up' ? 'up' : price.direction === 'down' ? 'down' : null
    if (direction) {
      setFlash(direction)
      const timer = setTimeout(() => setFlash(null), 500)
      return () => clearTimeout(timer)
    }
  }, [price?.price])

  return (
    <div
      onClick={onSelect}
      className={`p-2 rounded cursor-pointer transition-colors duration-500 ${
        flash === 'up'
          ? 'bg-green-500/20'
          : flash === 'down'
            ? 'bg-red-500/20'
            : 'hover:bg-gray-800'
      }`}
    >
      <div className="text-xs font-mono text-gray-400">{ticker}</div>
      <div className="text-sm font-bold text-white">${price?.price?.toFixed(2) || '—'}</div>
      <div className={`text-xs font-semibold ${price?.direction === 'up' ? 'text-green-up' : price?.direction === 'down' ? 'text-red-down' : 'text-gray-500'}`}>
        {price?.change_percent?.toFixed(2)}% {price?.direction === 'up' ? '↑' : price?.direction === 'down' ? '↓' : ''}
      </div>
      {history && history.length > 0 && <Sparkline data={history} direction={price?.direction || 'flat'} />}
    </div>
  )
}
