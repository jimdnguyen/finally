'use client';

import { useCallback, useEffect } from 'react';

import { ChatPanel } from '@/src/components/ChatPanel';
import { Header } from '@/src/components/Header';
import { Heatmap } from '@/src/components/Heatmap';
import { MainChart } from '@/src/components/MainChart';
import { PnlChart } from '@/src/components/PnlChart';
import { PositionsTable } from '@/src/components/PositionsTable';
import { ToastContainer } from '@/src/components/ToastContainer';
import { TradeBar } from '@/src/components/TradeBar';
import { WatchlistPanel } from '@/src/components/WatchlistPanel';
import { useMarketStream } from '@/src/hooks/useMarketStream';
import { useToast } from '@/src/hooks/useToast';
import { useTradingData } from '@/src/hooks/useTradingData';

export default function HomePage() {
  const {
    watchlist,
    selectedTicker,
    setSelectedTicker,
    portfolio,
    history,
    tickerHistory,
    selectedSeries,
    setConnectionState,
    onPriceBatch,
    trade,
    addTicker,
    removeTicker,
    chatMessages,
    isChatLoading,
    submitChat,
    clearTickerHistory,
    refreshStaticData,
  } = useTradingData();

  const streamState = useMarketStream({ onPriceBatch });
  const { toasts, show: showToast, dismiss: dismissToast } = useToast();

  const safeTrade = useCallback(
    async (payload: { ticker: string; quantity: number; side: 'buy' | 'sell' }) => {
      try {
        await trade(payload);
      } catch (err) {
        showToast(`Trade failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    },
    [trade, showToast],
  );

  const handleSourceSwitch = useCallback(() => {
    clearTickerHistory();
    void refreshStaticData();
  }, [clearTickerHistory, refreshStaticData]);

  const safeAddTicker = useCallback(
    async (ticker: string) => {
      try {
        await addTicker(ticker);
      } catch (err) {
        showToast(`Watchlist error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    },
    [addTicker, showToast],
  );

  useEffect(() => {
    setConnectionState(streamState);
  }, [setConnectionState, streamState]);

  return (
    <main className="min-h-screen overflow-x-clip bg-transparent">
      <Header totalValue={portfolio.total_value} cash={portfolio.cash_balance} connectionState={streamState} onSourceSwitch={handleSourceSwitch} />

      <div className="grid w-full grid-cols-1 gap-3 p-3 xl:h-[calc(100vh-98px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)_minmax(240px,280px)]">
        <div className="min-h-0 min-w-0 xl:h-full">
          <WatchlistPanel
            watchlist={watchlist}
            tickerHistory={tickerHistory}
            selectedTicker={selectedTicker}
            onSelectTicker={setSelectedTicker}
            onRemoveTicker={(ticker) => {
              void removeTicker(ticker);
            }}
          />
        </div>

        <div className="grid min-h-0 min-w-0 gap-3 xl:grid-rows-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
          <MainChart ticker={selectedTicker} series={selectedSeries} />
          <div className="grid min-h-0 gap-3 lg:grid-cols-2">
            <Heatmap positions={portfolio.positions} />
            <PnlChart data={history} />
          </div>
          <div className="grid min-h-0 gap-3">
            <PositionsTable positions={portfolio.positions} />
          </div>
        </div>

        <div className="grid min-h-0 min-w-0 gap-3 xl:grid-rows-[minmax(0,1fr)_auto]">
          <ChatPanel
            messages={chatMessages}
            loading={isChatLoading}
            onSubmit={submitChat}
          />
          <TradeBar
            defaultTicker={selectedTicker}
            onTrade={safeTrade}
            onAddTicker={safeAddTicker}
          />
        </div>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
