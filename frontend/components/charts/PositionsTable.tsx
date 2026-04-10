'use client'

import { usePortfolio } from '@/hooks/usePortfolio'

export function PositionsTable() {
  const { data: portfolio, isLoading, error } = usePortfolio()

  if (isLoading) {
    return (
      <div className="w-full bg-panel rounded border border-gray-700 p-4 text-gray-400">
        Loading positions...
      </div>
    )
  }

  if (error || !portfolio) {
    return (
      <div className="w-full bg-panel rounded border border-gray-700 p-4 text-red-down">
        Error loading positions
      </div>
    )
  }

  const positions = portfolio.positions || []

  if (positions.length === 0) {
    return (
      <div className="w-full bg-panel rounded border border-gray-700 p-4 text-gray-400">
        No positions yet
      </div>
    )
  }

  return (
    <div className="w-full bg-panel rounded border border-gray-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-900 border-b border-gray-700">
          <tr>
            <th className="px-4 py-2 text-left text-gray-300 font-semibold">Ticker</th>
            <th className="px-4 py-2 text-right text-gray-300 font-semibold">Qty</th>
            <th className="px-4 py-2 text-right text-gray-300 font-semibold">Avg Cost</th>
            <th className="px-4 py-2 text-right text-gray-300 font-semibold">Current</th>
            <th className="px-4 py-2 text-right text-gray-300 font-semibold">P&L</th>
            <th className="px-4 py-2 text-right text-gray-300 font-semibold">%</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => {
            const pnlColor = pos.unrealized_pnl >= 0 ? 'text-green-up' : 'text-red-down'
            const percentColor = (pos.unrealized_pnl_pct || 0) >= 0 ? 'text-green-up' : 'text-red-down'

            return (
              <tr
                key={pos.ticker}
                className="border-b border-gray-700 hover:bg-gray-800 transition-colors"
              >
                <td className="px-4 py-2 text-white font-mono">{pos.ticker}</td>
                <td className="px-4 py-2 text-right text-gray-300">
                  {pos.quantity.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right text-gray-300">
                  ${pos.avg_cost.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right text-gray-300">
                  ${pos.current_price.toFixed(2)}
                </td>
                <td className={`px-4 py-2 text-right font-semibold ${pnlColor}`}>
                  ${pos.unrealized_pnl.toFixed(2)}
                </td>
                <td className={`px-4 py-2 text-right font-semibold ${percentColor}`}>
                  {((pos.unrealized_pnl_pct || 0) * 100).toFixed(2)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
