'use client'

import ReactECharts from 'echarts-for-react'
import { usePortfolio } from '@/hooks/usePortfolio'

export function Treemap() {
  const { data: portfolio, isLoading, error } = usePortfolio()

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-gray-400">Loading portfolio...</div>
  }

  if (error || !portfolio) {
    return <div className="flex items-center justify-center h-full text-red-down">Error loading portfolio</div>
  }

  if (portfolio.positions.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400">No positions yet</div>
  }

  // Convert positions to treemap data — size by position value, color by P&L
  const treemapData = portfolio.positions.map((pos) => {
    const positionValue = pos.quantity * pos.current_price
    const pnl = pos.unrealized_pnl
    const color = pnl > 0 ? '#22c55e' : pnl < 0 ? '#ef4444' : '#4b5563'
    const pnlSign = pnl >= 0 ? '+' : ''

    return {
      name: pos.ticker,
      value: positionValue,
      pnl,
      itemStyle: { color },
      label: {
        show: true,
        fontSize: 12,
        color: '#ffffff',
        formatter: `{b}\n${pnlSign}$${pnl.toFixed(0)}`,
      },
    }
  })

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      textStyle: { color: '#ffffff' },
      borderColor: '#444',
      formatter: (params: any) => {
        const pnl = params.data?.pnl ?? 0
        const sign = pnl >= 0 ? '+' : ''
        return `${params.name}<br/>Value: $${(params.value || 0).toFixed(2)}<br/>P&L: ${sign}$${pnl.toFixed(2)}`
      },
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
    <div className="w-full h-full">
      <ReactECharts option={option} style={{ height: '100%' }} theme="dark" />
    </div>
  )
}
