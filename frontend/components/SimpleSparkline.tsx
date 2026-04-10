'use client';

import { SparklinePoint } from '@/hooks/useSSEPrices';

interface SimpleSparklineProps {
  data: SparklinePoint[];
  color: string;
  height?: number;
  width?: number;
}

export default function SimpleSparkline({
  data,
  color,
  height = 32,
  width = 48,
}: SimpleSparklineProps) {
  if (data.length < 2) {
    return <svg width={width} height={height} />;
  }

  const prices = data.map(d => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const padding = 2;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  // Generate points for polyline
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * graphWidth;
    const y = padding + graphHeight - ((d.price - min) / range) * graphHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
