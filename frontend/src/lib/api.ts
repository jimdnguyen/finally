import type { Portfolio, TradeRequest, WatchlistItem } from '@/types'

export class ApiError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText, code: String(res.status) }))
    throw new ApiError(body.error ?? body.message ?? res.statusText, body.code ?? String(res.status))
  }
  return res.json() as Promise<T>
}

export function fetchWatchlist(): Promise<WatchlistItem[]> {
  return apiFetch<WatchlistItem[]>('/api/watchlist')
}

export function fetchPortfolio(): Promise<Portfolio> {
  return apiFetch<Portfolio>('/api/portfolio')
}

export function executeTrade(req: TradeRequest): Promise<Portfolio> {
  return apiFetch<Portfolio>('/api/portfolio/trade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
}
