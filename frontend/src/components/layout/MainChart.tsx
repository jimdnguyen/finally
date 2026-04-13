'use client'

import { useEffect, useRef } from 'react'
import { createChart, LineSeries, ColorType } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts'
import { usePriceStore } from '@/stores/priceStore'
import type { SparklinePoint } from '@/stores/priceStore'

const EMPTY_POINTS: SparklinePoint[] = []

export default function MainChart() {
  const ticker = usePriceStore((s) => s.selectedTicker)
  const points = usePriceStore((s) => s.sparklines[ticker] ?? EMPTY_POINTS)
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const prevTickerRef = useRef(ticker)
  const prevLastTimeRef = useRef<number>(-1)

  // Chart creation + cleanup
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#8b949e',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#30363d' },
        horzLines: { color: '#30363d' },
      },
      crosshair: {
        vertLine: { color: '#30363d', labelBackgroundColor: '#753991' },
        horzLine: { color: '#30363d', labelBackgroundColor: '#753991' },
      },
      rightPriceScale: { borderColor: '#30363d' },
      timeScale: { borderColor: '#30363d', timeVisible: true, secondsVisible: true },
    })

    const series = chart.addSeries(LineSeries, {
      color: '#209dd7',
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    })

    chartRef.current = chart
    seriesRef.current = series

    // ResizeObserver
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      chart.resize(width, height)
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      chart.remove()
    }
  }, [])

  // Data updates
  useEffect(() => {
    if (!seriesRef.current) return

    const tickerChanged = ticker !== prevTickerRef.current
    prevTickerRef.current = ticker

    if (tickerChanged || points.length === 0) {
      seriesRef.current.setData(points)
      chartRef.current?.timeScale().fitContent()
      prevLastTimeRef.current = points.length > 0 ? (points[points.length - 1].time as number) : -1
    } else {
      const lastTime = points.length > 0 ? (points[points.length - 1].time as number) : -1
      if (lastTime > prevLastTimeRef.current) {
        seriesRef.current.update(points[points.length - 1])
        prevLastTimeRef.current = lastTime
      }
    }
  }, [ticker, points])

  return (
    <div className="w-full h-full" ref={containerRef} />
  )
}
