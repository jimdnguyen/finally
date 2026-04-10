'use client'

import { usePriceStore } from '@/store/priceStore'

export function ConnectionStatus() {
  const status = usePriceStore((s) => s.status)

  const dotColor = {
    live: 'bg-green-up',
    reconnecting: 'bg-yellow-400',
    connecting: 'bg-gray-400',
  }[status]

  const label = {
    live: 'Connected',
    reconnecting: 'Reconnecting',
    connecting: 'Connecting',
  }[status]

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  )
}
