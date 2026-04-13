'use client'

import { useEffect } from 'react'
import { usePriceStore } from '@/stores/priceStore'
import type { PriceUpdate } from '@/types'

const DISCONNECT_TIMEOUT_MS = 10_000

export function useSSE(): void {
  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''
    const es = new EventSource(`${backendUrl}/api/stream/prices`)
    let disconnectTimer: ReturnType<typeof setTimeout> | null = null

    es.onopen = () => {
      if (disconnectTimer !== null) {
        clearTimeout(disconnectTimer)
        disconnectTimer = null
      }
      usePriceStore.getState().setConnectionStatus('connected')
    }

    es.onmessage = (event: MessageEvent) => {
      let batch: Record<string, PriceUpdate>
      try {
        batch = JSON.parse(event.data)
      } catch (err) {
        console.error('[useSSE] Failed to parse SSE frame:', err, event.data)
        return
      }
      const { updatePrice } = usePriceStore.getState()
      for (const update of Object.values(batch)) {
        updatePrice(update)
      }
    }

    es.onerror = () => {
      usePriceStore.getState().setConnectionStatus('reconnecting')
      if (disconnectTimer === null) {
        disconnectTimer = setTimeout(() => {
          usePriceStore.getState().setConnectionStatus('disconnected')
          disconnectTimer = null
        }, DISCONNECT_TIMEOUT_MS)
      }
    }

    return () => {
      if (disconnectTimer !== null) clearTimeout(disconnectTimer)
      es.close()
    }
  }, [])
}
