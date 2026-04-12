'use client'

import { useEffect, useState } from 'react'
import WatchlistRow from './WatchlistRow'

const DEFAULT_TICKERS = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM', 'V', 'NFLX']

export default function WatchlistPanel() {
  const [tickers, setTickers] = useState<string[]>(DEFAULT_TICKERS)

  useEffect(() => {
    fetch('/api/watchlist')
      .then((r) => r.json())
      .then((data: { ticker: string }[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setTickers(data.map((item) => item.ticker))
        }
      })
      .catch(() => {
        // API unavailable — default tickers remain
      })
  }, [])

  return (
    <aside className="bg-surface border-r border-border overflow-y-auto">
      {tickers.map((ticker) => (
        <WatchlistRow key={ticker} ticker={ticker} />
      ))}
    </aside>
  )
}
