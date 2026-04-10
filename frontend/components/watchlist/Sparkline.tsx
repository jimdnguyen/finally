'use client'

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface SparklineProps {
  data: number[]
  direction: 'up' | 'down' | 'flat'
}

export function Sparkline({ data, direction }: SparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return

    const chart = echarts.init(containerRef.current)
    const color = direction === 'up' ? '#22c55e' : direction === 'down' ? '#ef4444' : '#8b8b8b'

    const option = {
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { type: 'category', show: false },
      yAxis: { type: 'value', show: false },
      series: [
        {
          data,
          type: 'line',
          smooth: true,
          lineStyle: { color, width: 1.5 },
          areaStyle: { color: `${color}20` },
          itemStyle: { opacity: 0 },
          symbol: 'none',
        },
      ],
    }

    chart.setOption(option)

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.dispose()
    }
  }, [data, direction])

  return <div ref={containerRef} style={{ width: '100%', height: '32px' }} />
}
