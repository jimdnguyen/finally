'use client'

import ReactECharts from 'echarts-for-react'
import { usePortfolioHistory } from '@/hooks/usePortfolioHistory'

export function PnLChart() {
  const { data: history, isLoading, error } = usePortfolioHistory()

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>
  }

  if (error || !history) {
    return <div className="flex items-center justify-center h-full text-red-down">Error loading history</div>
  }

  const snapshots = history.snapshots || []

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      textStyle: { color: '#ffffff' },
      borderColor: '#444',
      formatter: (params: any) => {
        if (!params || params.length === 0) return ''
        const value = params[0].value
        return `$${Number(value).toFixed(2)}`
      },
    },
    grid: {
      left: '8%',
      right: '4%',
      top: '8%',
      bottom: '12%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: snapshots.map((s) => {
        const date = new Date(s.recorded_at)
        return date.toLocaleTimeString()
      }),
      axisLine: { lineStyle: { color: '#444' } },
      axisLabel: { color: '#888', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      scale: true,  // auto-range so small P&L changes are visible
      axisLine: { lineStyle: { color: '#444' } },
      axisLabel: { color: '#888' },
      splitLine: { lineStyle: { color: '#333' } },
    },
    series: [
      {
        data: snapshots.map((s) => s.total_value),
        type: 'line',
        smooth: true,
        lineStyle: {
          color: '#209dd7',  // blue-primary
          width: 2,
        },
        areaStyle: {
          color: 'rgba(32, 157, 215, 0.1)',
        },
        itemStyle: { opacity: 0 },
        symbol: 'none',
      },
    ],
  }

  return (
    <div className="w-full h-full">
      {snapshots.length < 2 ? (
        <div className="flex items-center justify-center h-full text-gray-400">
          {snapshots.length === 0 ? 'No portfolio history yet' : 'Collecting history...'}
        </div>
      ) : (
        <ReactECharts option={option} style={{ height: '100%' }} theme="dark" />
      )}
    </div>
  )
}
