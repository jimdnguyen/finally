'use client'

import { WatchlistRow } from './WatchlistRow'

export function WatchlistPanel({
  tickers,
  onTickerClick,
}: {
  tickers: string[]
  onTickerClick: (ticker: string) => void
}) {
  return (
    <div className="w-full h-full bg-panel border-r border-gray-700 overflow-y-auto flex flex-col gap-1 p-2">
      {tickers.map((ticker) => (
        <WatchlistRow
          key={ticker}
          ticker={ticker}
          onSelect={() => onTickerClick(ticker)}
        />
      ))}
    </div>
  )
}
