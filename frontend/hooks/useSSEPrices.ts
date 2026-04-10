'use client';

import { useEffect, useRef, useState } from 'react';

export interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  timestamp: string;
  direction: 'up' | 'down' | 'unchanged';
}

export interface SparklinePoint {
  price: number;
  timestamp: string;
}

export function useSSEPrices() {
  const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());
  const [sparklines, setSparklines] = useState<Map<string, SparklinePoint[]>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const connect = () => {
      try {
        const eventSource = new EventSource('/api/stream/prices');
        eventSourceRef.current = eventSource;
        setConnectionStatus('connected');

        eventSource.onopen = () => {
          setConnectionStatus('connected');
        };

        eventSource.onmessage = (event) => {
          try {
            const batch = JSON.parse(event.data) as Record<string, PriceUpdate>;

            setPrices((prev) => {
              const next = new Map(prev);
              for (const [ticker, update] of Object.entries(batch)) {
                next.set(ticker, update);
              }
              return next;
            });

            setSparklines((prev) => {
              const next = new Map(prev);
              for (const [ticker, update] of Object.entries(batch)) {
                const current = next.get(ticker) || [];
                const updated = [...current, { price: update.price, timestamp: update.timestamp }];
                if (updated.length > 60) updated.shift();
                next.set(ticker, updated);
              }
              return next;
            });
          } catch (error) {
            console.error('Failed to parse SSE message:', error);
          }
        };

        eventSource.onerror = () => {
          if (eventSource.readyState === EventSource.CLOSED) {
            setConnectionStatus('disconnected');
            eventSource.close();
            // Retry after 3 seconds
            setTimeout(connect, 3000);
          } else {
            setConnectionStatus('reconnecting');
          }
        };
      } catch (error) {
        console.error('Failed to create EventSource:', error);
        setConnectionStatus('disconnected');
        setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    prices,
    sparklines,
    connectionStatus,
  };
}
