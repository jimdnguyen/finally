export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

export interface PriceUpdate {
  ticker: string
  price: number
  previous_price: number
  timestamp: string
  direction: 'up' | 'down' | 'flat'
  change: number
  change_percent: number
}

export interface WatchlistItem {
  ticker: string
  price: number | null
}

export interface Position {
  ticker: string
  quantity: number
  avg_cost: number
  current_price: number
  unrealized_pnl: number
  pnl_pct: number
}

export interface Portfolio {
  cash_balance: number
  positions: Position[]
  total_value: number
}

export interface PortfolioSnapshot {
  recorded_at: string
  total_value: number
}
