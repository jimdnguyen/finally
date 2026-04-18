'use client'

import { useState } from 'react'
import Header from "@/components/layout/Header";
import WatchlistPanel from "@/components/layout/WatchlistPanel";
import CenterPanel from "@/components/layout/CenterPanel";
import ChatPanel from "@/components/layout/ChatPanel";

export default function Home() {
  const [showWatchlist, setShowWatchlist] = useState(true)
  const [showChat, setShowChat] = useState(true)

  return (
    <div className="flex flex-col h-full">
      <Header />
      {/* Desktop layout: 3-column grid */}
      <main className="hidden md:grid grid-cols-[180px_1fr_300px] flex-1 overflow-hidden">
        <WatchlistPanel />
        <CenterPanel />
        <ChatPanel />
      </main>

      {/* Tablet layout: 2-column, collapsible panels */}
      <main className="hidden sm:grid md:hidden grid-cols-[140px_1fr] flex-1 overflow-hidden">
        {showWatchlist && <WatchlistPanel />}
        <div className="flex flex-col">
          <CenterPanel />
          <div className="border-t border-border">
            {showChat && <ChatPanel />}
          </div>
          <div className="flex gap-2 p-2 bg-surface border-t border-border">
            <button
              onClick={() => setShowWatchlist(!showWatchlist)}
              className="px-2 py-1 text-xs bg-border rounded hover:bg-blue-primary hover:text-white transition-colors"
            >
              {showWatchlist ? 'Hide' : 'Show'} Watchlist
            </button>
            <button
              onClick={() => setShowChat(!showChat)}
              className="px-2 py-1 text-xs bg-border rounded hover:bg-purple-action hover:text-white transition-colors"
            >
              {showChat ? 'Hide' : 'Show'} Chat
            </button>
          </div>
        </div>
      </main>

      {/* Mobile layout: single column, tab between panels */}
      <main className="sm:hidden flex-1 overflow-hidden flex flex-col">
        <CenterPanel />
        <div className="flex gap-2 p-2 bg-surface border-t border-border">
          <button
            onClick={() => setShowWatchlist(!showWatchlist)}
            className="flex-1 px-2 py-2 text-xs bg-border rounded hover:bg-blue-primary hover:text-white transition-colors"
          >
            {showWatchlist ? 'Hide' : 'Show'} Watchlist
          </button>
          <button
            onClick={() => setShowChat(!showChat)}
            className="flex-1 px-2 py-2 text-xs bg-border rounded hover:bg-purple-action hover:text-white transition-colors"
          >
            {showChat ? 'Hide' : 'Show'} Chat
          </button>
        </div>
        {showWatchlist && (
          <div className="h-1/3 border-t border-border overflow-auto">
            <WatchlistPanel />
          </div>
        )}
        {showChat && (
          <div className="h-1/3 border-t border-border overflow-auto">
            <ChatPanel />
          </div>
        )}
      </main>
    </div>
  );
}
