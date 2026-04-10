'use client'

import { useState } from 'react'
import { usePriceStore } from '@/store/priceStore'
import { usePortfolio } from '@/hooks/usePortfolio'
import { WatchlistPanel } from '@/components/watchlist/WatchlistPanel'
import { MainChart } from '@/components/charts/MainChart'
import { Treemap } from '@/components/charts/Treemap'
import { PnLChart } from '@/components/charts/PnLChart'
import { PositionsTable } from '@/components/charts/PositionsTable'
import { TradeBar } from '@/components/header/TradeBar'
import { ConnectionStatus } from '@/components/header/ConnectionStatus'
import { ChatPanel } from '@/components/chat/ChatPanel'

export default function Page() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const { data: portfolio } = usePortfolio()

  // Default to first available price if nothing selected
  const prices = usePriceStore((s) => s.prices)
  const defaultTicker =
    selectedTicker || Object.keys(prices)[0] || 'AAPL'
  const displayTicker = selectedTicker || defaultTicker

  return (
    <main className="flex flex-col h-screen w-screen bg-base text-white">
      {/* Header: Portfolio value, connection status, trade bar */}
      <header className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-accent-yellow">
            FinAlly
          </h1>
          <div className="flex flex-col">
            <span className="text-3xl font-semibold text-gray-100">
              ${portfolio?.total_value.toFixed(2) || '10,000.00'}
            </span>
            <span className="text-xs text-gray-400">
              Cash: ${portfolio?.cash_balance.toFixed(2) || '10,000.00'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <ConnectionStatus />

          <TradeBar selectedTicker={displayTicker} />
        </div>
      </header>

      {/* Main content grid */}
      <div className="flex-1 overflow-hidden grid grid-cols-3 gap-6 p-6">
        {/* Left: Watchlist (220px fixed) */}
        <div className="col-span-1 overflow-hidden">
          <WatchlistPanel
            tickers={Object.keys(prices).length > 0 ? Object.keys(prices) : ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM', 'V', 'NFLX']}
            onTickerClick={setSelectedTicker}
          />
        </div>

        {/* Center: Charts (2 columns) */}
        <div className="col-span-2 flex flex-col gap-6">
          {/* Main Chart */}
          <div className="flex-1 bg-panel rounded border border-gray-700 p-4 overflow-hidden">
            <h2 className="text-sm font-semibold text-gray-100 mb-4">
              {displayTicker} Price Action
            </h2>
            <MainChart ticker={displayTicker} />
          </div>

          {/* Portfolio charts row */}
          <div className="grid grid-cols-2 gap-6">
            {/* Treemap */}
            <div className="bg-panel rounded border border-gray-700 p-4 overflow-hidden">
              <h2 className="text-sm font-semibold text-gray-100 mb-4">
                Portfolio Allocation
              </h2>
              <Treemap />
            </div>

            {/* P&L Chart */}
            <div className="bg-panel rounded border border-gray-700 p-4 overflow-hidden">
              <h2 className="text-sm font-semibold text-gray-100 mb-4">
                P&L History
              </h2>
              <PnLChart />
            </div>
          </div>
        </div>

        {/* Right: Positions & Chat */}
        <div className="col-span-1 flex flex-col gap-6 overflow-hidden">
          {/* Positions table */}
          <div className="flex-1 bg-panel rounded border border-gray-700 p-4 overflow-auto">
            <h2 className="text-sm font-semibold text-gray-100 mb-4">
              Positions
            </h2>
            <PositionsTable />
          </div>

          {/* Chat panel */}
          <div className="h-80 bg-panel rounded border border-gray-700 overflow-hidden">
            <ChatPanel />
          </div>
        </div>
      </div>
    </main>
  )
}
