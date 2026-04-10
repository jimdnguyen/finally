'use client';

import { useState } from 'react';
import { SparklinePoint } from '@/hooks/useSSEPrices';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartPanelProps {
  ticker: string;
  sparklineData: SparklinePoint[];
  currentPrice: number;
  onTrade: (ticker: string, quantity: number, side: 'buy' | 'sell') => Promise<any>;
}

export default function ChartPanel({
  ticker,
  sparklineData,
  currentPrice,
  onTrade,
}: ChartPanelProps) {
  const [quantity, setQuantity] = useState('1');
  const [isTrading, setIsTrading] = useState(false);
  const [tradeMessage, setTradeMessage] = useState('');

  const handleTrade = async (side: 'buy' | 'sell') => {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setTradeMessage('Invalid quantity');
      return;
    }

    setIsTrading(true);
    setTradeMessage('');

    try {
      const result = await onTrade(ticker, qty, side);
      if (result?.success) {
        setTradeMessage(`✓ ${side.toUpperCase()} ${qty} ${ticker} executed`);
        setQuantity('1');
      } else {
        setTradeMessage(result?.message || 'Trade failed');
      }
    } catch (error) {
      setTradeMessage('Error executing trade');
    } finally {
      setIsTrading(false);
      setTimeout(() => setTradeMessage(''), 3000);
    }
  };

  const chartData = sparklineData.map((point, idx) => ({
    time: new Date(point.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    price: point.price,
  }));

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div>
        <div className="text-sm text-gray-400 uppercase tracking-wider mb-1">
          Selected
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold text-white font-mono">{ticker}</div>
          <div className="text-2xl font-mono text-accent-blue">
            ${currentPrice.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 border border-dark-border rounded bg-dark-bg overflow-hidden">
        {sparklineData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#c9d1d9' }}
                stroke="#30363d"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#c9d1d9' }}
                stroke="#30363d"
                type="number"
                domain={['dataMin - 1', 'dataMax + 1']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '4px',
                }}
                formatter={(value: number) => `$${value.toFixed(2)}`}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#209dd7"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
            Waiting for price data...
          </div>
        )}
      </div>

      {/* Trade Bar */}
      <div className="border border-dark-border rounded p-4 bg-dark-bg space-y-3">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">
            Quantity
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="0.01"
            step="0.01"
            className="w-full px-3 py-2 bg-dark-panel border border-dark-border rounded text-white font-mono focus:outline-none focus:border-accent-blue"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleTrade('buy')}
            disabled={isTrading}
            className="flex-1 px-4 py-2 bg-accent-blue text-dark-bg font-bold rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            BUY
          </button>
          <button
            onClick={() => handleTrade('sell')}
            disabled={isTrading}
            className="flex-1 px-4 py-2 bg-loss-red text-white font-bold rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            SELL
          </button>
        </div>

        {tradeMessage && (
          <div className={`text-xs px-2 py-1 rounded ${
            tradeMessage.startsWith('✓')
              ? 'bg-profit-green bg-opacity-20 text-profit-green'
              : 'bg-loss-red bg-opacity-20 text-loss-red'
          }`}>
            {tradeMessage}
          </div>
        )}
      </div>
    </div>
  );
}
