'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchMarketSource, switchMarketSource } from '@/src/lib/api';

type MarketSource = 'massive' | 'simulator';

interface MarketSourceToggleProps {
  onSwitch?: () => void;
}

const LiveIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12h2l3-9 4 18 4-18 3 9h2" />
  </svg>
);

const SimIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

export const MarketSourceToggle = ({ onSwitch }: MarketSourceToggleProps) => {
  const [source, setSource] = useState<MarketSource>('simulator');
  const [massiveAvailable, setMassiveAvailable] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetchMarketSource().then((status) => {
      setSource(status.current_source);
      setMassiveAvailable(status.massive_available);
    });
  }, []);

  const handleToggle = useCallback(async () => {
    if (switching || !massiveAvailable) return;
    const target: MarketSource = source === 'massive' ? 'simulator' : 'massive';
    setSwitching(true);
    try {
      const result = await switchMarketSource(target);
      setSource(result.current_source as MarketSource);
      onSwitch?.();
    } catch {
      // stay on current source
    } finally {
      setSwitching(false);
    }
  }, [source, switching, massiveAvailable, onSwitch]);

  if (!massiveAvailable) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-terminal-dim">
        {source === 'massive' ? 'LIVE' : 'SIM'}
      </span>
      <button
        type="button"
        onClick={handleToggle}
        disabled={switching}
        data-testid="market-source-toggle"
        className="rounded p-1.5 text-terminal-dim transition-colors hover:text-terminal-text disabled:opacity-50"
        aria-label={source === 'massive' ? 'Switch to simulated data' : 'Switch to live data'}
        title={source === 'massive' ? 'Live data (Massive) — click for simulated' : 'Simulated data — click for live'}
      >
        {switching ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : source === 'massive' ? (
          <LiveIcon />
        ) : (
          <SimIcon />
        )}
      </button>
    </div>
  );
};
