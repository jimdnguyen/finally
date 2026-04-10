'use client'

import { ChatMessage as ChatMessageType } from '@/hooks/useChatMessages'

interface Props {
  message: ChatMessageType
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs px-3 py-2 rounded text-sm ${
          isUser
            ? 'bg-blue-primary text-white'
            : 'bg-gray-700 text-gray-100'
        }`}
      >
        {/* Message text */}
        <p className="whitespace-pre-wrap">{message.content}</p>

        {/* Trade confirmations */}
        {message.actions?.trades && message.actions.trades.length > 0 && (
          <div className="mt-2 pt-2 border-t border-opacity-30 border-current space-y-1">
            {message.actions.trades.map((trade, idx) => (
              <div key={idx} className="text-xs opacity-90">
                {trade.side === 'buy' ? '🟢' : '🔴'} {trade.side.toUpperCase()}{' '}
                {trade.quantity} {trade.ticker}
              </div>
            ))}
          </div>
        )}

        {/* Watchlist confirmations */}
        {message.actions?.watchlist_changes &&
          message.actions.watchlist_changes.length > 0 && (
            <div className="mt-2 pt-2 border-t border-opacity-30 border-current space-y-1">
              {message.actions.watchlist_changes.map((change, idx) => (
                <div key={idx} className="text-xs opacity-90">
                  {change.action === 'add' ? '➕' : '➖'}{' '}
                  {change.ticker}
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}
