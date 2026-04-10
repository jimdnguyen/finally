'use client'

import { useState } from 'react'
import { WatchlistPanel } from '@/components/watchlist/WatchlistPanel'
import { ConnectionStatus } from '@/components/header/ConnectionStatus'

const DEFAULT_TICKERS = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM', 'V', 'NFLX']

export default function Page() {
  const [selectedTicker, setSelectedTicker] = useState(DEFAULT_TICKERS[0])

  return (
    <div className="flex flex-col h-screen w-screen bg-base text-white">
      {/* Header */}
      <header className="h-16 bg-panel border-b border-gray-700 px-4 flex items-center justify-between">
        <div className="text-xl font-bold text-accent-yellow">FinAlly</div>
        <ConnectionStatus />
      </header>

      {/* Main content (3-column layout) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Watchlist (220px) */}
        <WatchlistPanel
          tickers={DEFAULT_TICKERS}
          onTickerClick={setSelectedTicker}
        />

        {/* Center column (flex-1) - placeholder for charts */}
        <main className="flex-1 bg-base p-4 overflow-auto">
          <div className="text-gray-400">Main chart area - selected: {selectedTicker}</div>
        </main>

        {/* Chat sidebar (300px) - placeholder */}
        <aside className="w-[300px] bg-panel border-l border-gray-700 p-4 overflow-auto">
          <div className="text-gray-400">Chat panel placeholder</div>
        </aside>
      </div>
    </div>
  )
}
