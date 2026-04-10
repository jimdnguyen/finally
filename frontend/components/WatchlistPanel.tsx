'use client';

import { useState } from 'react';
import { PriceUpdate, SparklinePoint } from '@/hooks/useSSEPrices';
import SimpleSparkline from './SimpleSparkline';

interface WatchlistPanelProps {
  prices: Map<string, PriceUpdate>;
  sparklines: Map<string, SparklinePoint[]>;
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  onAddTicker: (ticker: string) => Promise<void>;
  onRemoveTicker: (ticker: string) => Promise<void>;
}

export default function WatchlistPanel({
  prices,
  sparklines,
  selectedTicker,
  onSelectTicker,
  onAddTicker,
  onRemoveTicker,
}: WatchlistPanelProps) {
  const [newTicker, setNewTicker] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const tickers = Array.from(prices.keys()).sort();

  const handleAddTicker = async () => {
    if (!newTicker.trim()) return;
    setIsAdding(true);
    try {
      await onAddTicker(newTicker.toUpperCase());
      setNewTicker('');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-dark-border">
        <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Watchlist</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-dark-border">
          {tickers.map((ticker) => {
            const priceData = prices.get(ticker);
            const sparklineData = sparklines.get(ticker) || [];
            const isSelected = ticker === selectedTicker;

            if (!priceData) return null;

            const changePercent = priceData.price > 0
              ? ((priceData.price - priceData.previous_price) / priceData.previous_price) * 100
              : 0;

            return (
              <div
                key={ticker}
                onClick={() => onSelectTicker(ticker)}
                className={`px-3 py-3 cursor-pointer transition ${
                  isSelected
                    ? 'bg-dark-border bg-opacity-50'
                    : 'hover:bg-dark-border hover:bg-opacity-30'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="font-mono font-bold text-white text-sm">{ticker}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTicker(ticker);
                    }}
                    className="text-xs text-gray-500 hover:text-loss-red transition"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-mono text-sm font-semibold text-white">
                      ${priceData.price.toFixed(2)}
                    </div>
                    <div
                      className={`text-xs font-mono ${
                        changePercent >= 0
                          ? 'text-profit-green'
                          : 'text-loss-red'
                      }`}
                    >
                      {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                    </div>
                  </div>

                  {sparklineData.length > 1 && (
                    <div className="w-12 h-8">
                      <SimpleSparkline
                        data={sparklineData}
                        color={changePercent >= 0 ? '#3fb950' : '#f85149'}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add ticker input */}
      <div className="border-t border-dark-border p-3 space-y-2">
        <input
          type="text"
          value={newTicker}
          onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
          onKeyPress={(e) => e.key === 'Enter' && handleAddTicker()}
          placeholder="Add ticker..."
          className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue"
        />
        <button
          onClick={handleAddTicker}
          disabled={isAdding || !newTicker.trim()}
          className="w-full px-3 py-2 bg-accent-blue text-dark-bg font-semibold text-sm rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isAdding ? 'Adding...' : 'Add'}
        </button>
      </div>
    </div>
  );
}
