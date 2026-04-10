'use client'

import { useEffect } from 'react'
import { usePriceStore } from '@/store/priceStore'

export function usePriceStream() {
  const { setPrice, setStatus } = usePriceStore()

  useEffect(() => {
    setStatus('connecting')
    const base = process.env.NEXT_PUBLIC_API_URL ?? ''
    const eventSource = new EventSource(`${base}/api/stream/prices`)

    eventSource.onopen = () => {
      setStatus('live')
    }

    eventSource.onerror = () => {
      setStatus('reconnecting')
      // Browser will auto-retry via SSE retry header from backend
    }

    eventSource.onmessage = (event) => {
      try {
        const batch = JSON.parse(event.data)
        // Payload is { AAPL: PriceUpdate, GOOGL: PriceUpdate, ... }
        for (const update of Object.values(batch) as any[]) {
          if (update.ticker && typeof update.price === 'number') {
            setPrice(update.ticker, update)
          }
        }
      } catch (e) {
        console.error('Failed to parse price update:', e)
      }
    }

    return () => {
      eventSource.close()
      setStatus('connecting')
    }
  }, [setPrice, setStatus])
}
