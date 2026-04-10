'use client'

import { useState } from 'react'

interface Props {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled = false }: Props) {
  const [input, setInput] = useState('')

  const handleSend = () => {
    const trimmed = input.trim()
    if (trimmed) {
      onSend(trimmed)
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="px-3 py-3 border-t border-gray-700 bg-panel">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask me..."
          className="flex-1 px-3 py-2 rounded bg-gray-800 text-gray-100 text-sm placeholder-gray-500 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="px-3 py-2 rounded bg-purple-submit text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          Send
        </button>
      </div>
    </div>
  )
}
