'use client';

interface HeaderProps {
  portfolioValue: number;
  cashBalance: number;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
}

export default function Header({ portfolioValue, cashBalance, connectionStatus }: HeaderProps) {
  const statusColor = {
    connected: 'bg-profit-green',
    reconnecting: 'bg-yellow-500',
    disconnected: 'bg-loss-red',
  }[connectionStatus];

  const statusText = {
    connected: 'Connected',
    reconnecting: 'Reconnecting...',
    disconnected: 'Disconnected',
  }[connectionStatus];

  return (
    <header className="border-b border-dark-border bg-dark-panel px-6 py-4 flex items-center justify-between">
      <div className="text-2xl font-bold text-accent-yellow">
        FinAlly
      </div>

      <div className="flex items-center gap-8">
        <div className="text-right">
          <div className="text-xs text-gray-400 uppercase tracking-wider">Portfolio Value</div>
          <div className="text-lg font-mono font-bold text-white">
            ${portfolioValue.toFixed(2)}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-gray-400 uppercase tracking-wider">Cash Balance</div>
          <div className="text-lg font-mono font-bold text-accent-blue">
            ${cashBalance.toFixed(2)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${statusColor}`} />
          <span className="text-xs text-gray-400">{statusText}</span>
        </div>
      </div>
    </header>
  );
}
