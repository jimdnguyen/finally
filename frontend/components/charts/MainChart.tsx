'use client'

import ReactECharts from 'echarts-for-react'
import { usePriceStore } from '@/store/priceStore'

interface MainChartProps {
  ticker: string
  isLoading?: boolean
}

export function MainChart({ ticker, isLoading = false }: MainChartProps) {
  const history = usePriceStore((s) => s.history[ticker] || [])
  const price = usePriceStore((s) => s.prices[ticker])

  const option = {
    title: {
      text: `${ticker} Price Chart`,
      textStyle: { color: '#ffffff' },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      textStyle: { color: '#ffffff' },
      borderColor: '#444',
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
      data: history.map((_, i) => i),  // Index-based x-axis
      axisLine: { lineStyle: { color: '#444' } },
      axisLabel: { color: '#888' },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#444' } },
      axisLabel: { color: '#888' },
      splitLine: { lineStyle: { color: '#333' } },
    },
    series: [
      {
        data: history,
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
    <div className="w-full h-[300px] bg-panel rounded border border-gray-700">
      {isLoading ? (
        <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>
      ) : history.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-400">
          No price history yet
        </div>
      ) : (
        <ReactECharts option={option} style={{ height: '100%' }} />
      )}
    </div>
  )
}
