import StatusDot from './StatusDot'

export default function Header() {
  return (
    <header className="h-12 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0">
      <span className="font-mono text-accent-yellow font-semibold tracking-wide">
        FinAlly
      </span>
      <StatusDot />
    </header>
  )
}
