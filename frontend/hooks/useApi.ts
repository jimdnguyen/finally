'use client';

import { useState } from 'react';

export interface Portfolio {
  cash_balance: number;
  total_value: number;
  positions: Position[];
}

export interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  unrealized_pnl: number;
  pnl_percent: number;
}

export interface WatchlistItem {
  ticker: string;
  price: number;
  change_percent: number;
  direction: 'up' | 'down' | 'unchanged';
}

export interface HistoryItem {
  total_value: number;
  recorded_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  trades_executed?: Array<{ ticker: string; side: string; quantity: number; price: number }>;
  watchlist_changes?: Array<{ ticker: string; action: string }>;
}

export interface ChatResponse {
  message: string;
  trades_executed?: Array<{ ticker: string; side: string; quantity: number; price: number }>;
  watchlist_changes?: Array<{ ticker: string; action: string }>;
}

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiCall = async <T,>(url: string, options?: RequestInit): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('API call failed:', message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getPortfolio = () => apiCall<Portfolio>('/api/portfolio');

  const getWatchlist = () => apiCall<WatchlistItem[]>('/api/watchlist');

  const getPortfolioHistory = () => apiCall<HistoryItem[]>('/api/portfolio/history');

  const executeTrade = (ticker: string, quantity: number, side: 'buy' | 'sell') =>
    apiCall<{ success: boolean; message?: string }>('/api/portfolio/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, quantity, side }),
    });

  const addTicker = (ticker: string) =>
    apiCall<{ success: boolean; message?: string }>('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
    });

  const removeTicker = (ticker: string) =>
    apiCall<{ success: boolean; message?: string }>(`/api/watchlist/${ticker}`, {
      method: 'DELETE',
    });

  const sendChatMessage = (message: string) =>
    apiCall<ChatResponse>('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

  return {
    loading,
    error,
    getPortfolio,
    getWatchlist,
    getPortfolioHistory,
    executeTrade,
    addTicker,
    removeTicker,
    sendChatMessage,
  };
}
