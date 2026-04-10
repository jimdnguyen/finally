'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatResponse } from '@/hooks/useApi';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  trades_executed?: Array<{ ticker: string; side: string; quantity: number; price: number }>;
  watchlist_changes?: Array<{ ticker: string; action: string }>;
}

interface ChatPanelProps {
  onSendMessage: (message: string) => Promise<ChatResponse | null>;
}

export default function ChatPanel({ onSendMessage }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await onSendMessage(input);

      if (response) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.message,
          trades_executed: response.trades_executed,
          watchlist_changes: response.watchlist_changes,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-dark-border">
        <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
          AI Assistant
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-xs text-gray-500 text-center py-8">
            Start chatting with FinAlly...
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs px-3 py-2 rounded text-sm ${
                msg.role === 'user'
                  ? 'bg-accent-blue text-dark-bg rounded-br-none'
                  : 'bg-dark-border text-gray-100 rounded-bl-none'
              }`}
            >
              <div>{msg.content}</div>

              {/* Show executed actions */}
              {msg.role === 'assistant' && (
                <>
                  {msg.trades_executed && msg.trades_executed.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-500 text-xs space-y-1">
                      {msg.trades_executed.map((trade, i) => (
                        <div key={i} className="text-accent-yellow">
                          ✓ {trade.side.toUpperCase()} {trade.quantity} {trade.ticker} @ ${trade.price.toFixed(2)}
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.watchlist_changes && msg.watchlist_changes.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-500 text-xs space-y-1">
                      {msg.watchlist_changes.map((change, i) => (
                        <div key={i} className="text-accent-yellow">
                          ✓ {change.action.toUpperCase()} {change.ticker}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-dark-border text-gray-100 px-3 py-2 rounded rounded-bl-none text-sm">
              <div className="flex gap-1 items-center h-5">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-dark-border p-3 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Ask FinAlly..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 bg-dark-panel border border-dark-border rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-3 py-2 bg-accent-yellow text-dark-bg font-bold rounded text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
