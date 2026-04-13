'use client'

import { useEffect, useRef } from 'react'
import { createChart, LineSeries, ColorType } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts'
import { usePortfolioStore } from '@/stores/portfolioStore'

export default function PnLHistoryChart() {
  const history = usePortfolioStore((s) => s.history)
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null)

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
      timeScale: { borderColor: '#30363d' },
    })

    const series = chart.addSeries(LineSeries, {
      color: '#209dd7',
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    })

    chartRef.current = chart
    seriesRef.current = series

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
    if (!seriesRef.current || !history || history.length === 0) return

    const mapped = history.map((snap) => ({
      time: Math.floor(new Date(snap.recorded_at).getTime() / 1000) as import('lightweight-charts').UTCTimestamp,
      value: snap.total_value,
    }))

    seriesRef.current.setData(mapped)
    chartRef.current?.timeScale().fitContent()
  }, [history])

  const empty = !history || history.length === 0

  return (
    <div className="relative w-full h-full">
      {empty && (
        <div className="absolute inset-0 flex items-center justify-center text-text-muted text-sm z-10">
          No history yet — portfolio snapshots appear after your first trade
        </div>
      )}
      <div className={`w-full h-full ${empty ? 'invisible' : ''}`} ref={containerRef} />
    </div>
  )
}
