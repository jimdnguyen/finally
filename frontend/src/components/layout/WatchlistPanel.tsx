'use client'

import { useState } from 'react'
import { useWatchlistStore } from '@/stores/watchlistStore'
import { addToWatchlist, fetchWatchlist } from '@/lib/api'
import WatchlistRow from './WatchlistRow'

export default function WatchlistPanel() {
  const tickers = useWatchlistStore((s) => s.tickers)
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  async function handleAdd() {
    if (isAdding) return
    const ticker = inputValue.trim().toUpperCase()
    if (!ticker) {
      setError('Enter a ticker symbol')
      return
    }
    setError('')
    setIsAdding(true)
    try {
      await addToWatchlist(ticker)
      const items = await fetchWatchlist()
      useWatchlistStore.getState().setTickers(items.map((i) => i.ticker))
      setInputValue('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add ticker')
    } finally {
      setIsAdding(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd()
    else setError('')
  }

  return (
    <aside className="bg-surface border-r border-border overflow-y-auto flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {tickers.map((ticker) => (
          <WatchlistRow key={ticker} ticker={ticker} />
        ))}
      </div>
      <div className="px-3 py-2 border-t border-border">
        <input
          data-testid="add-ticker-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add ticker..."
          disabled={isAdding}
          className="w-full border-0 border-b border-border bg-transparent font-mono text-xs text-text-primary outline-none focus:border-b-blue-primary placeholder:text-text-muted disabled:opacity-40"
        />
        {error && <p className="text-red-down text-xs mt-1">{error}</p>}
      </div>
    </aside>
  )
}
