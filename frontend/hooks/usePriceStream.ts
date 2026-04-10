'use client'

import { useEffect } from 'react'
import { usePriceStore } from '@/store/priceStore'

export function usePriceStream() {
  const { setPrice, setStatus } = usePriceStore()

  useEffect(() => {
    setStatus('connecting')
    const eventSource = new EventSource('/api/stream/prices')

    eventSource.onopen = () => {
      setStatus('live')
    }

    eventSource.onerror = () => {
      setStatus('reconnecting')
      // Browser will auto-retry via SSE retry header from backend
    }

    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data)
        // Validate update has required fields before setting (XSS prevention)
        if (update.ticker && typeof update.price === 'number') {
          setPrice(update.ticker, update)
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
