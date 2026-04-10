'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import WatchlistPanel from '@/components/WatchlistPanel';
import ChartPanel from '@/components/ChartPanel';
import ChatPanel from '@/components/ChatPanel';
import PortfolioPanel from '@/components/PortfolioPanel';
import { useSSEPrices } from '@/hooks/useSSEPrices';
import { useApi, Portfolio, HistoryItem } from '@/hooks/useApi';

export default function Home() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const { prices, sparklines, connectionStatus } = useSSEPrices();
  const api = useApi();

  // Load portfolio and history on mount and periodically refresh
  useEffect(() => {
    const loadData = async () => {
      const [portfolioData, historyData] = await Promise.all([
        api.getPortfolio(),
        api.getPortfolioHistory(),
      ]);

      if (portfolioData) setPortfolio(portfolioData);
      if (historyData) setHistory(historyData);
    };

    loadData();
    const interval = setInterval(loadData, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-dark-bg text-gray-100">
      {/* Header */}
      <Header
        portfolioValue={portfolio?.total_value ?? 0}
        cashBalance={portfolio?.cash_balance ?? 0}
        connectionStatus={connectionStatus}
      />

      {/* Main layout: 3-column */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* Left: Watchlist */}
        <div className="w-80 border-r border-dark-border bg-dark-panel overflow-hidden flex flex-col">
          <WatchlistPanel
            prices={prices}
            sparklines={sparklines}
            selectedTicker={selectedTicker}
            onSelectTicker={setSelectedTicker}
            onAddTicker={async (ticker) => {
              await api.addTicker(ticker);
              // Refresh watchlist by reloading portfolio
              const data = await api.getPortfolio();
              if (data) setPortfolio(data);
            }}
            onRemoveTicker={async (ticker) => {
              await api.removeTicker(ticker);
              // Refresh watchlist
              const data = await api.getPortfolio();
              if (data) setPortfolio(data);
            }}
          />
        </div>

        {/* Center: Chart and Trade */}
        <div className="flex-1 flex flex-col border-r border-dark-border">
          <ChartPanel
            ticker={selectedTicker}
            sparklineData={sparklines.get(selectedTicker) || []}
            currentPrice={prices.get(selectedTicker)?.price ?? 0}
            onTrade={async (ticker, quantity, side) => {
              const result = await api.executeTrade(ticker, quantity, side);
              if (result) {
                // Refresh portfolio
                const data = await api.getPortfolio();
                if (data) setPortfolio(data);
              }
              return result;
            }}
          />
        </div>

        {/* Right top: Chat */}
        <div className="w-80 border-b border-dark-border bg-dark-panel flex flex-col">
          <ChatPanel
            onSendMessage={async (message) => {
              const response = await api.sendChatMessage(message);
              if (response) {
                // Refresh portfolio after chat (in case trades were executed)
                const data = await api.getPortfolio();
                if (data) setPortfolio(data);
              }
              return response;
            }}
          />
        </div>

        {/* Right bottom: Portfolio */}
        <div className="w-80 bg-dark-panel flex flex-col overflow-hidden" style={{ borderLeft: '1px solid #30363d' }}>
          <PortfolioPanel
            portfolio={portfolio}
            history={history}
          />
        </div>
      </div>
    </div>
  );
}
