'use client'

import ReactECharts from 'echarts-for-react'
import { usePortfolio } from '@/hooks/usePortfolio'

export function Treemap() {
  const { data: portfolio, isLoading, error } = usePortfolio()

  if (isLoading) {
    return (
      <div className="w-full h-full bg-panel rounded border border-gray-700 flex items-center justify-center text-gray-400">
        Loading portfolio...
      </div>
    )
  }

  if (error || !portfolio) {
    return (
      <div className="w-full h-full bg-panel rounded border border-gray-700 flex items-center justify-center text-red-down">
        Error loading portfolio
      </div>
    )
  }

  // Convert positions to treemap data
  const treemapData = portfolio.positions.map((pos) => {
    const value = Math.abs(pos.unrealized_pnl)
    const color = pos.unrealized_pnl >= 0 ? '#22c55e' : '#ef4444'

    return {
      name: pos.ticker,
      value,
      itemStyle: { color },
      label: {
        show: true,
        fontSize: 12,
        color: '#ffffff',
      },
    }
  })

  const option = {
    title: {
      text: 'Portfolio Positions (sized by weight, colored by P&L)',
      textStyle: { color: '#ffffff', fontSize: 14 },
      left: 'center',
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      textStyle: { color: '#ffffff' },
      borderColor: '#444',
      formatter: (params: any) =>
        `${params.name}<br/>P&L: $${(params.value || 0).toFixed(2)}`,
    },
    series: [
      {
        type: 'treemap',
        data: treemapData,
        label: { position: 'insideTopLeft' },
        breadcrumb: { show: false },
        roam: false,
      },
    ],
  }

  return (
    <div className="w-full h-full bg-panel rounded border border-gray-700">
      <ReactECharts option={option} style={{ height: '100%' }} />
    </div>
  )
}
