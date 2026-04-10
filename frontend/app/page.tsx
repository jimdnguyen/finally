'use client'

import { useState } from 'react'
import { WatchlistPanel } from '@/components/watchlist/WatchlistPanel'
import { MainChart } from '@/components/charts/MainChart'
import { Treemap } from '@/components/charts/Treemap'
import { PnLChart } from '@/components/charts/PnLChart'
import { ConnectionStatus } from '@/components/header/ConnectionStatus'
import { TradeBar } from '@/components/header/TradeBar'
import { PositionsTable } from '@/components/charts/PositionsTable'

const DEFAULT_TICKERS = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM', 'V', 'NFLX']

export default function Page() {
  const [selectedTicker, setSelectedTicker] = useState(DEFAULT_TICKERS[0])

  return (
    <div className="flex flex-col h-screen w-screen bg-base text-white">
      {/* Header */}
      <header className="h-16 bg-panel border-b border-gray-700 px-4 flex items-center justify-between">
        <div className="text-xl font-bold text-accent-yellow">FinAlly</div>
        <TradeBar selectedTicker={selectedTicker} />
        <ConnectionStatus />
      </header>

      {/* Main content (3-column layout) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Watchlist (220px) */}
        <WatchlistPanel
          tickers={DEFAULT_TICKERS}
          onTickerClick={setSelectedTicker}
        />

        {/* Center column (flex-1) */}
        <main className="flex-1 bg-base p-4 overflow-auto flex flex-col gap-4">
          <MainChart ticker={selectedTicker} />
          {/* Portfolio row (heatmap + P&L) */}
          <div className="flex gap-4 flex-1 min-h-0">
            <div className="flex-1">
              <Treemap />
            </div>
            <div className="flex-1">
              <PnLChart />
            </div>
          </div>
          {/* Positions table */}
          <PositionsTable />
        </main>

        {/* Chat sidebar (300px) - placeholder */}
        <aside className="w-[300px] bg-panel border-l border-gray-700 p-4 overflow-auto">
          <div className="text-gray-400">Chat panel placeholder</div>
        </aside>
      </div>
    </div>
  )
}
