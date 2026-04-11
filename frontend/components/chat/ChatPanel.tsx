'use client'

import { useEffect, useRef } from 'react'
import { useChatMessages } from '@/hooks/useChatMessages'
import { useChatMutation } from '@/hooks/useChatMutation'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'

export function ChatPanel() {
  const { data: messages = [], isLoading } = useChatMessages()
  const { mutate: sendMessage, isPending } = useChatMutation()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSendMessage = (text: string) => {
    sendMessage({ message: text })
  }

  return (
    <div className="flex flex-col h-full bg-panel border-l border-gray-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-100">FinAlly AI</h2>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {isLoading ? (
          <div className="text-center text-gray-400 text-sm">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 text-sm">
            Ask me about your portfolio, prices, or trades
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))
        )}
      </div>

      {/* Loading indicator */}
      {isPending && (
        <div className="px-4 py-2 text-gray-400 text-xs">
          Thinking...
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={isPending}
      />
    </div>
  )
}
