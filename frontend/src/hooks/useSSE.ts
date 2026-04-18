'use client'

import { useEffect } from 'react'
import { usePriceStore } from '@/stores/priceStore'
import type { PriceUpdate } from '@/types'

const DISCONNECT_TIMEOUT_MS = 2000
const RECONNECT_INTERVAL_MS = 1000

export function useSSE(): void {
  useEffect(() => {
    let stopped = false
    // Always points to the active connection's teardown
    let currentCleanup: (() => void) | null = null

    function connect() {
      if (stopped) return

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''
      const es = new EventSource(`${backendUrl}/api/stream/prices`)
      let disconnectTimer: ReturnType<typeof setTimeout> | null = null
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null
      let isDisconnected = false

      currentCleanup = () => {
        isDisconnected = true
        if (disconnectTimer !== null) { clearTimeout(disconnectTimer); disconnectTimer = null }
        if (reconnectTimer !== null) { clearTimeout(reconnectTimer); reconnectTimer = null }
        es.close()
      }

      const markConnected = () => {
        isDisconnected = false
        if (disconnectTimer !== null) {
          clearTimeout(disconnectTimer)
          disconnectTimer = null
        }
        usePriceStore.getState().setConnectionStatus('connected')
      }

      es.onopen = markConnected

      es.onmessage = (event: MessageEvent) => {
        // Also mark connected on message — onopen is not always reliable in Chromium
        markConnected()

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
        if (isDisconnected) return
        usePriceStore.getState().setConnectionStatus('reconnecting')
        if (disconnectTimer === null) {
          disconnectTimer = setTimeout(() => {
            isDisconnected = true
            disconnectTimer = null
            usePriceStore.getState().setConnectionStatus('disconnected')
            // Close the stalled EventSource and schedule a fresh reconnect.
            // Firefox may enter CLOSED state on repeated network errors and stop
            // retrying — recreating forces a clean reconnection attempt.
            es.close()
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null
              connect()
            }, RECONNECT_INTERVAL_MS)
          }, DISCONNECT_TIMEOUT_MS)
        }
      }
    }

    connect()

    return () => {
      stopped = true
      currentCleanup?.()
    }
  }, [])
}
