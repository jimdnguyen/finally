'use client'

import React, { useEffect, useRef, useState } from 'react'
import { sendChatMessage } from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolioStore'
import type { ChatResponse } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LogEntry =
  | { type: 'user'; text: string; id: string }
  | { type: 'ai-label'; timestamp: string; id: string; loading?: boolean }
  | { type: 'ai'; text: string; id: string }
  | { type: 'exec-ok'; text: string; id: string }
  | { type: 'exec-fail'; text: string; id: string; retryText?: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

let _id = 0
function uid(): string {
  return String(++_id)
}

function buildResponseEntries(response: ChatResponse): LogEntry[] {
  const entries: LogEntry[] = [
    { type: 'ai', text: response.message, id: uid() },
  ]
  for (const t of response.trades_executed) {
    if (t.status === 'executed') {
      entries.push({
        type: 'exec-ok',
        text: `${t.ticker} ${t.side.toUpperCase()} ${t.quantity}${t.price != null ? ` @ $${t.price.toFixed(2)}` : ''} ✓ OK`,
        id: uid(),
      })
    } else {
      entries.push({
        type: 'exec-fail',
        text: `${t.ticker} ${t.side.toUpperCase()} failed — ${t.error ?? 'unknown error'}`,
        id: uid(),
      })
    }
  }
  for (const w of response.watchlist_changes_applied) {
    if (w.status === 'ok') {
      entries.push({ type: 'exec-ok', text: `Watchlist: ${w.action} ${w.ticker} ✓ OK`, id: uid() })
    } else {
      entries.push({ type: 'exec-fail', text: `Watchlist: ${w.action} ${w.ticker} failed — ${w.error ?? 'unknown error'}`, id: uid() })
    }
  }
  return entries
}

// ---------------------------------------------------------------------------
// ChatLog
// ---------------------------------------------------------------------------

function ChatLog({
  entries,
  onRetry,
}: {
  entries: LogEntry[]
  onRetry?: (text: string) => void
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [entries.length])

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-sm">
      {entries.map((entry) => {
        switch (entry.type) {
          case 'user':
            return (
              <div key={entry.id} className="text-accent-yellow">
                {'> '}{entry.text}
              </div>
            )
          case 'ai-label':
            return (
              <div key={entry.id} className="flex items-center gap-2 mt-2">
                <span
                  className="inline-block w-[18px] h-[18px] rounded-full bg-purple-action flex-shrink-0"
                  aria-hidden="true"
                />
                <span className="text-text-primary font-semibold text-xs">AI</span>
                <span className="text-text-muted text-xs">{entry.timestamp}</span>
                {entry.loading && (
                  <span className="text-text-muted animate-blink ml-1">...</span>
                )}
              </div>
            )
          case 'ai':
            return (
              <div key={entry.id} className="border-l-2 border-blue-primary pl-2 text-text-primary">
                {entry.text}
              </div>
            )
          case 'exec-ok':
            return (
              <div key={entry.id} className="text-green-up text-xs pl-2">
                {entry.text}
              </div>
            )
          case 'exec-fail':
            return (
              <div key={entry.id} role="alert" className="text-red-down text-xs pl-2 flex items-center gap-2">
                <span>{entry.text}</span>
                {entry.retryText && (
                  <button
                    onClick={() => onRetry?.(entry.retryText!)}
                    className="text-xs text-blue-primary underline ml-1 hover:no-underline"
                  >
                    Retry
                  </button>
                )}
              </div>
            )
        }
      })}
      <div ref={bottomRef} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ChatInput
// ---------------------------------------------------------------------------

function ChatInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void
  disabled: boolean
}) {
  const [value, setValue] = useState('')

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    setValue('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="flex items-center gap-2 border-t border-border p-2">
      <label htmlFor="chat-message-input" className="sr-only">Chat message input</label>
      <span className="text-text-muted font-mono text-sm flex-shrink-0" aria-hidden="true">{'>'}</span>
      <input
        id="chat-message-input"
        data-testid="chat-input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="buy 10 AAPL · analyze portfolio"
        className="flex-1 bg-transparent border-0 border-b border-border font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-blue-primary focus:outline-none disabled:opacity-50"
        aria-label="Chat message input"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled}
        aria-label={disabled ? 'Sending message...' : 'Send message'}
        className="bg-purple-action text-white uppercase text-xs px-3 py-1 rounded-none disabled:opacity-50 flex-shrink-0"
      >
        SEND
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ChatPanelInner
// ---------------------------------------------------------------------------

const GREETING_LABEL_ID = 'greeting-label'
const GREETING_AI_ID = 'greeting-ai'

function ChatPanelInner() {
  const [entries, setEntries] = useState<LogEntry[]>([
    { type: 'ai-label', timestamp: now(), id: GREETING_LABEL_ID },
    {
      type: 'ai',
      text: 'Hi! I\'m FinAlly, your AI trading assistant. Ask me to analyze your portfolio, suggest trades, or just buy 10 AAPL.',
      id: GREETING_AI_ID,
    },
  ])
  const [pending, setPending] = useState(false)

  async function handleSubmit(text: string) {
    const userEntry: LogEntry = { type: 'user', text, id: uid() }
    const loadingLabelId = uid()
    const loadingLabel: LogEntry = { type: 'ai-label', timestamp: now(), id: loadingLabelId, loading: true }

    setEntries((prev) => [...prev, userEntry, loadingLabel])
    setPending(true)

    try {
      const response = await sendChatMessage(text)
      const responseEntries = buildResponseEntries(response)

      // Replace loading label with non-loading version, then append response rows
      setEntries((prev) =>
        prev
          .map((e) => (e.id === loadingLabelId ? { ...e, loading: false } : e))
          .concat(responseEntries)
      )

      if (response.trades_executed.some((t) => t.status === 'executed')) {
        usePortfolioStore.getState().refresh().catch(() => {})
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setEntries((prev) =>
        prev
          .map((e) => (e.id === loadingLabelId ? { ...e, loading: false } : e))
          .concat([{ type: 'exec-fail', text: `Error: ${message}`, id: uid(), retryText: text }])
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <aside className="bg-surface border-l border-border flex flex-col h-full">
      <ChatLog entries={entries} onRetry={handleSubmit} />
      <ChatInput onSubmit={handleSubmit} disabled={pending} />
    </aside>
  )
}

// ---------------------------------------------------------------------------
// ChatErrorBoundary
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
  hasError: boolean
}

class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <aside className="bg-surface border-l border-border flex items-center justify-center p-4">
          <p className="text-red-down text-sm font-mono">Chat unavailable</p>
        </aside>
      )
    }
    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default function ChatPanel() {
  return (
    <ChatErrorBoundary>
      <ChatPanelInner />
    </ChatErrorBoundary>
  )
}
