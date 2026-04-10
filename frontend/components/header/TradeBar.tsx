'use client'

import { useState, useEffect } from 'react'
import { useTradeExecution } from '@/hooks/useTradeExecution'

interface TradeBarProps {
  selectedTicker: string
}

export function TradeBar({ selectedTicker }: TradeBarProps) {
  const [ticker, setTicker] = useState('')
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState('')
  const { mutate: executeTrade, isPending } = useTradeExecution()

  // Auto-fill ticker when selectedTicker changes
  useEffect(() => {
    setTicker(selectedTicker || '')
  }, [selectedTicker])

  const handleTrade = (side: 'buy' | 'sell') => {
    setError('')

    // Validation
    if (!ticker.trim()) {
      setError('Ticker required')
      return
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      setError('Quantity must be > 0')
      return
    }

    executeTrade(
      {
        ticker: ticker.toUpperCase(),
        side,
        quantity: parseFloat(quantity),
      },
      {
        onError: (err) => {
          setError((err as Error).message || 'Trade failed')
        },
        onSuccess: () => {
          // Clear fields after successful trade
          setQuantity('')
          setError('')
        },
      }
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder="Ticker"
        value={ticker}
        onChange={(e) => setTicker(e.target.value)}
        disabled={isPending}
        className="px-2 py-1 bg-gray-800 text-white text-sm rounded border border-gray-600 focus:outline-none focus:border-blue-primary disabled:opacity-50"
      />
      <input
        type="number"
        placeholder="Qty"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        disabled={isPending}
        step="0.01"
        min="0"
        className="px-2 py-1 bg-gray-800 text-white text-sm rounded border border-gray-600 focus:outline-none focus:border-blue-primary disabled:opacity-50 w-20"
      />
      <button
        onClick={() => handleTrade('buy')}
        disabled={isPending || !ticker.trim() || !quantity}
        className="px-3 py-1 bg-blue-primary text-white text-sm font-semibold rounded hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        BUY
      </button>
      <button
        onClick={() => handleTrade('sell')}
        disabled={isPending || !ticker.trim() || !quantity}
        className="px-3 py-1 bg-purple-submit text-white text-sm font-semibold rounded hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        SELL
      </button>
      {error && <div className="text-red-down text-xs">{error}</div>}
    </div>
  )
}
