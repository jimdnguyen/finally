'use client'

import { useState, useEffect } from 'react'
import { usePriceStore } from '@/stores/priceStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { executeTrade, fetchPortfolioHistory } from '@/lib/api'

export default function TradeBar() {
  const selectedTicker = usePriceStore((s) => s.selectedTicker)
  const [ticker, setTicker] = useState(selectedTicker)
  const [quantity, setQuantity] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setTicker(selectedTicker)
  }, [selectedTicker])

  async function handleTrade(side: 'buy' | 'sell') {
    if (isSubmitting) return
    const qty = Number(quantity)
    if (!ticker.trim() || !qty || qty <= 0) return

    setError('')
    setIsSubmitting(true)
    try {
      const portfolio = await executeTrade({ ticker: ticker.trim(), quantity: qty, side })
      usePortfolioStore.getState().setPortfolio(portfolio)
      fetchPortfolioHistory()
        .then((history) => usePortfolioStore.getState().setHistory(history))
        .catch(() => {})
      setQuantity('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Trade failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleTrade('buy')
    }
  }

  return (
    <div className="border-t border-b border-border px-3 py-2">
      <div className="flex items-center gap-3">
        <input
          data-testid="trade-ticker"
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="AAPL"
          className="w-24 border-0 border-b border-border bg-transparent font-mono text-sm outline-none focus:border-b-blue-primary"
        />
        <input
          data-testid="trade-quantity"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="100"
          min="1"
          className="w-20 border-0 border-b border-border bg-transparent font-mono text-sm outline-none focus:border-b-blue-primary"
        />
        <button
          data-testid="buy-button"
          onClick={() => handleTrade('buy')}
          disabled={isSubmitting}
          className="bg-purple-action text-white uppercase text-xs font-semibold font-sans tracking-wide px-4 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Buy
        </button>
        <button
          data-testid="sell-button"
          onClick={() => handleTrade('sell')}
          disabled={isSubmitting}
          className="bg-purple-action text-white uppercase text-xs font-semibold font-sans tracking-wide px-4 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Sell
        </button>
      </div>
      {error && (
        <p className="text-red-down text-xs mt-1">{error}</p>
      )}
    </div>
  )
}
