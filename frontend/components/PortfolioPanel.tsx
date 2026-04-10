'use client';

import { useEffect, useState } from 'react';
import { Portfolio, HistoryItem } from '@/hooks/useApi';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Treemap, Cell } from 'recharts';

interface PortfolioPanelProps {
  portfolio: Portfolio | null;
  history: HistoryItem[];
}

interface TreemapNode {
  [key: string]: any;
  name: string;
  value: number;
  pnl_percent: number;
  fill: string;
}

export default function PortfolioPanel({ portfolio, history }: PortfolioPanelProps) {
  const [activeTab, setActiveTab] = useState<'treemap' | 'chart' | 'positions'>('treemap');
  const [treemapData, setTreemapData] = useState<TreemapNode[]>([]);

  useEffect(() => {
    if (portfolio?.positions) {
      const data: TreemapNode[] = portfolio.positions.map((pos) => {
        const totalValue = pos.quantity * pos.current_price;
        const isProfit = pos.pnl_percent >= 0;

        return {
          name: pos.ticker,
          value: Math.max(totalValue, 1000), // Min value for visibility
          pnl_percent: pos.pnl_percent,
          fill: isProfit ? '#3fb950' : '#f85149',
        };
      });

      // Add cash balance
      data.push({
        name: 'Cash',
        value: Math.max(portfolio.cash_balance, 1000),
        pnl_percent: 0,
        fill: '#209dd7',
      });

      setTreemapData(data);
    }
  }, [portfolio]);

  const chartData = history.map((item) => ({
    time: new Date(item.recorded_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    value: item.total_value,
    timestamp: new Date(item.recorded_at).getTime(),
  }));

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-dark-border">
        <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">
          Portfolio
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('treemap')}
            className={`text-xs px-2 py-1 rounded transition ${
              activeTab === 'treemap'
                ? 'bg-accent-blue text-dark-bg'
                : 'bg-dark-bg text-gray-400 hover:text-white'
            }`}
          >
            Heat Map
          </button>
          <button
            onClick={() => setActiveTab('chart')}
            className={`text-xs px-2 py-1 rounded transition ${
              activeTab === 'chart'
                ? 'bg-accent-blue text-dark-bg'
                : 'bg-dark-bg text-gray-400 hover:text-white'
            }`}
          >
            P&L
          </button>
          <button
            onClick={() => setActiveTab('positions')}
            className={`text-xs px-2 py-1 rounded transition ${
              activeTab === 'positions'
                ? 'bg-accent-blue text-dark-bg'
                : 'bg-dark-bg text-gray-400 hover:text-white'
            }`}
          >
            Positions
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'treemap' && (
          <div className="w-full h-full flex items-center justify-center">
            {treemapData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treemapData}
                  dataKey="value"
                  aspectRatio={16 / 9}
                  stroke="#30363d"
                  fill="#8884d8"
                >
                  {treemapData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Treemap>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-gray-500">No positions</div>
            )}
          </div>
        )}

        {activeTab === 'chart' && (
          <div className="w-full h-full">
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10 }}
                    stroke="#30363d"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    stroke="#30363d"
                    type="number"
                    domain={['dataMin - 100', 'dataMax + 100']}
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
                    dataKey="value"
                    stroke="#209dd7"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-gray-500 text-center py-8">
                Waiting for data...
              </div>
            )}
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="space-y-2">
            {portfolio?.positions && portfolio.positions.length > 0 ? (
              <div className="space-y-2">
                {portfolio.positions.map((pos) => (
                  <div key={pos.ticker} className="bg-dark-bg rounded p-2 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white">{pos.ticker}</span>
                      <span className={`font-mono ${
                        pos.pnl_percent >= 0
                          ? 'text-profit-green'
                          : 'text-loss-red'
                      }`}>
                        {pos.pnl_percent >= 0 ? '+' : ''}{pos.pnl_percent.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>{pos.quantity.toFixed(4)} @ ${pos.avg_cost.toFixed(2)}</span>
                      <span className="text-accent-blue">${(pos.quantity * pos.current_price).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400 text-xs">
                      <span>Now: ${pos.current_price.toFixed(2)}</span>
                      <span className={pos.unrealized_pnl >= 0 ? 'text-profit-green' : 'text-loss-red'}>
                        {pos.unrealized_pnl >= 0 ? '+' : ''}${pos.unrealized_pnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 text-center py-8">
                No positions
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
