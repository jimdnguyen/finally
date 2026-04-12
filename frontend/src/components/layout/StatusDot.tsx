'use client'

import { usePriceStore } from '@/stores/priceStore'

const STATUS_CONFIG = {
  connected: {
    dotClass: 'bg-green-up',
    dotStyle: { boxShadow: '0 0 6px #3fb950' },
    textClass: 'text-green-up',
    label: 'LIVE',
  },
  reconnecting: {
    dotClass: 'bg-accent-yellow animate-pulse',
    dotStyle: {},
    textClass: 'text-accent-yellow',
    label: 'RECONNECTING',
  },
  disconnected: {
    dotClass: 'bg-red-down',
    dotStyle: {},
    textClass: 'text-red-down',
    label: 'DISCONNECTED',
  },
} as const

export default function StatusDot() {
  const connectionStatus = usePriceStore((s) => s.connectionStatus)
  const config = STATUS_CONFIG[connectionStatus]

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block w-2 h-2 rounded-full ${config.dotClass}`}
        style={config.dotStyle}
      />
      <span className={`text-xs font-mono ${config.textClass}`}>{config.label}</span>
    </div>
  )
}
