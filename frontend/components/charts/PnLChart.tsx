'use client'

import ReactECharts from 'echarts-for-react'
import { usePortfolioHistory } from '@/hooks/usePortfolioHistory'

export function PnLChart() {
  const { data: history, isLoading, error } = usePortfolioHistory()

  if (isLoading) {
    return (
      <div className="w-full h-full bg-panel rounded border border-gray-700 flex items-center justify-center text-gray-400">
        Loading...
      </div>
    )
  }

  if (error || !history) {
    return (
      <div className="w-full h-full bg-panel rounded border border-gray-700 flex items-center justify-center text-red-down">
        Error loading history
      </div>
    )
  }

  const snapshots = history.snapshots || []

  const option = {
    title: {
      text: 'Portfolio Value Over Time',
      textStyle: { color: '#ffffff', fontSize: 14 },
      left: 'center',
    },
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
      left: '10%',
      right: '10%',
      top: '15%',
      bottom: '10%',
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
    <div className="w-full h-full bg-panel rounded border border-gray-700">
      {snapshots.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-400">
          No portfolio history yet
        </div>
      ) : (
        <ReactECharts option={option} style={{ height: '100%' }} />
      )}
    </div>
  )
}
