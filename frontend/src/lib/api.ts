import type { ChatResponse, Portfolio, PortfolioSnapshot, TradeRequest, WatchlistItem } from '@/types'

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
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function fetchWatchlist(): Promise<WatchlistItem[]> {
  return apiFetch<WatchlistItem[]>('/api/watchlist')
}

export function fetchPortfolio(): Promise<Portfolio> {
  return apiFetch<Portfolio>('/api/portfolio')
}

export function fetchPortfolioHistory(): Promise<PortfolioSnapshot[]> {
  return apiFetch<PortfolioSnapshot[]>('/api/portfolio/history')
}

export function executeTrade(req: TradeRequest): Promise<Portfolio> {
  return apiFetch<Portfolio>('/api/portfolio/trade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
}

export function addToWatchlist(ticker: string): Promise<WatchlistItem> {
  return apiFetch<WatchlistItem>('/api/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker }),
  })
}

export function removeFromWatchlist(ticker: string): Promise<void> {
  return apiFetch<void>(`/api/watchlist/${encodeURIComponent(ticker)}`, {
    method: 'DELETE',
  })
}

export function clearChatHistory(): Promise<void> {
  return apiFetch<void>('/api/chat/history', { method: 'DELETE' })
}

export function sendChatMessage(message: string): Promise<ChatResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 35_000)
  return apiFetch<ChatResponse>('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId))
}
