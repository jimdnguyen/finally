'use client'

import ReactECharts from 'echarts-for-react'
import { usePriceStore } from '@/store/priceStore'

interface MainChartProps {
  ticker: string
  isLoading?: boolean
}

const EMPTY_HISTORY: number[] = []
const EMPTY_TIMESTAMPS: string[] = []

export function MainChart({ ticker, isLoading = false }: MainChartProps) {
  const history = usePriceStore((s) => s.history[ticker] ?? EMPTY_HISTORY)
  const timestamps = usePriceStore((s) => s.timestamps[ticker] ?? EMPTY_TIMESTAMPS)
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      textStyle: { color: '#ffffff' },
      borderColor: '#444',
      formatter: (params: any) => {
        if (!params?.length) return ''
        const ts = timestamps[params[0].dataIndex]
        const time = ts ? new Date(ts).toLocaleTimeString() : ''
        return `${time}<br/>$${Number(params[0].value).toFixed(2)}`
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
      data: timestamps.map((ts) => new Date(ts).toLocaleTimeString()),
      axisLine: { lineStyle: { color: '#444' } },
      axisLabel: { color: '#888', fontSize: 10, interval: 'auto' },
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      scale: true,  // auto-range instead of forcing 0 baseline
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
    <div className="w-full h-full">
      {isLoading ? (
        <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>
      ) : history.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-400">
          No price history yet
        </div>
      ) : (
        <ReactECharts option={option} style={{ height: '100%' }} theme="dark" />
      )}
    </div>
  )
}
