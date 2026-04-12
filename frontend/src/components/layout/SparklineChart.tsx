'use client'

import { useEffect, useRef } from 'react'
import { createChart, LineSeries } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, LineData } from 'lightweight-charts'
import type { SparklinePoint } from '@/stores/priceStore'

interface SparklineChartProps {
  points: SparklinePoint[]
  width?: number
  height?: number
}

export default function SparklineChart({ points, width = 52, height = 20 }: SparklineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      width,
      height,
      layout: {
        background: { color: 'transparent' },
        textColor: 'transparent',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      handleScroll: false,
      handleScale: false,
    })

    const series = chart.addSeries(LineSeries, {
      color: '#209dd7',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    chartRef.current = chart
    seriesRef.current = series

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [width, height])

  useEffect(() => {
    if (!seriesRef.current || points.length === 0) return
    seriesRef.current.setData(points as LineData[])
  }, [points])

  return <div ref={containerRef} style={{ width, height }} />
}
