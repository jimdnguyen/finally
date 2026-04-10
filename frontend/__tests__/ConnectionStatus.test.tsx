import { describe, it, expect, beforeEach } from 'vitest'
import { usePriceStore } from '@/store/priceStore'

describe('ConnectionStatus integration', () => {
  beforeEach(() => {
    usePriceStore.setState({ status: 'connecting' })
  })

  it('should store live status', () => {
    usePriceStore.setState({ status: 'live' })
    expect(usePriceStore.getState().status).toBe('live')
  })

  it('should store reconnecting status', () => {
    usePriceStore.setState({ status: 'reconnecting' })
    expect(usePriceStore.getState().status).toBe('reconnecting')
  })

  it('should store connecting status', () => {
    usePriceStore.setState({ status: 'connecting' })
    expect(usePriceStore.getState().status).toBe('connecting')
  })
})
