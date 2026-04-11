'use client'

import { usePortfolio } from '@/hooks/usePortfolio'

export function PositionsTable() {
  const { data: portfolio, isLoading, error } = usePortfolio()

  if (isLoading) return <div className="text-gray-400 text-sm">Loading positions...</div>
  if (error || !portfolio) return <div className="text-red-down text-sm">Error loading positions</div>

  const positions = portfolio.positions || []

  if (positions.length === 0) return <div className="text-gray-400 text-sm">No positions yet</div>

  return (
    <table className="w-full text-xs">
      <thead className="border-b border-gray-700">
        <tr>
          <th className="pb-2 text-left text-gray-400 font-medium">Ticker</th>
          <th className="pb-2 text-right text-gray-400 font-medium">Qty</th>
          <th className="pb-2 text-right text-gray-400 font-medium">Avg</th>
          <th className="pb-2 text-right text-gray-400 font-medium">Price</th>
          <th className="pb-2 text-right text-gray-400 font-medium">P&L</th>
          <th className="pb-2 text-right text-gray-400 font-medium">%</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((pos) => {
          const costBasis = pos.avg_cost * pos.quantity
          const pnlPct = costBasis > 0 ? (pos.unrealized_pnl / costBasis) * 100 : 0
          const pnlColor = pos.unrealized_pnl >= 0 ? 'text-green-up' : 'text-red-down'

          return (
            <tr key={pos.ticker} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
              <td className="py-2 pr-2 text-white font-mono font-semibold">{pos.ticker}</td>
              <td className="py-2 text-right text-gray-300">{pos.quantity.toFixed(2)}</td>
              <td className="py-2 text-right text-gray-300">${pos.avg_cost.toFixed(2)}</td>
              <td className="py-2 text-right text-gray-300">${pos.current_price.toFixed(2)}</td>
              <td className={`py-2 text-right font-semibold ${pnlColor}`}>
                {pos.unrealized_pnl >= 0 ? '+' : ''}${pos.unrealized_pnl.toFixed(2)}
              </td>
              <td className={`py-2 text-right font-semibold ${pnlColor}`}>
                {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
