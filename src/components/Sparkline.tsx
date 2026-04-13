"use client";

import { useEffect, useState } from "react";

interface SparklineProps {
  // Current holdings: symbol → USD value at current prices
  holdings: Map<string, number>;
}

interface ChartPoint {
  timestamp: number;
  value: number;
}

// Fetch 7-day MON price history from DefiLlama (main driver of portfolio value)
async function fetchPriceHistory(): Promise<ChartPoint[]> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - 7 * 86400;
    // Use MON price as the portfolio proxy (most holdings are MON-denominated)
    const res = await fetch(
      `https://coins.llama.fi/chart/coingecko:monad?start=${weekAgo}&span=168&period=1h`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const prices = data.coins?.["coingecko:monad"]?.prices;
    if (!Array.isArray(prices)) return [];
    return prices.map((p: { timestamp: number; price: number }) => ({
      timestamp: p.timestamp,
      value: p.price,
    }));
  } catch {
    return [];
  }
}

export function PortfolioSparkline({ holdings }: SparklineProps) {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchPriceHistory().then((history) => {
      if (history.length === 0) return;

      // Calculate total MON-denominated holdings
      // For simplicity, we scale the MON price curve by the portfolio's MON exposure
      const currentMonPrice = history[history.length - 1]?.value || 1;
      const monHoldings = (holdings.get("MON") || 0) + (holdings.get("WMON") || 0);
      const lstHoldings =
        (holdings.get("aprMON") || 0) +
        (holdings.get("shMON") || 0) +
        (holdings.get("sMON") || 0) +
        (holdings.get("gMON") || 0);
      const stableHoldings =
        (holdings.get("USDC") || 0) +
        (holdings.get("USDT0") || 0) +
        (holdings.get("AUSD") || 0) +
        (holdings.get("USD1") || 0);

      // MON-correlated value (scales with MON price)
      const monCorrelated = monHoldings + lstHoldings;
      // Stable value (doesn't scale)
      const monUnits = monCorrelated / currentMonPrice;

      const scaled = history.map((p) => ({
        timestamp: p.timestamp,
        value: monUnits * p.value + stableHoldings,
      }));

      setPoints(scaled);
    });
  }, [holdings]);

  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const width = 100;
  const height = 40;
  const padding = 2;

  const pathPoints = points.map((p, i) => {
    const x = padding + (i / (points.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((p.value - minVal) / range) * (height - 2 * padding);
    return `${x},${y}`;
  });
  const linePath = `M${pathPoints.join(" L")}`;
  const areaPath = `${linePath} L${width - padding},${height} L${padding},${height} Z`;

  const firstVal = values[0];
  const lastVal = values[values.length - 1];
  const changePercent = ((lastVal - firstVal) / firstVal) * 100;
  const isPositive = changePercent >= 0;
  const color = isPositive ? "var(--color-positive)" : "var(--color-negative)";

  const displayPoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="card mb-5 px-5 py-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] tracking-[0.6px] text-[var(--color-text-muted)]">
          7-DAY TREND
        </div>
        <div className="flex items-center gap-2">
          {displayPoint && (
            <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">
              ${displayPoint.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              {" · "}
              {new Date(displayPoint.timestamp * 1000).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <span
            className="text-[12px] font-semibold"
            style={{ color }}
          >
            {isPositive ? "+" : ""}{changePercent.toFixed(1)}%
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: 60 }}
        preserveAspectRatio="none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          const idx = Math.round(x * (points.length - 1));
          setHoverIndex(Math.max(0, Math.min(idx, points.length - 1)));
        }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#sparkFill)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="0.5" />
        {hoverIndex !== null && (
          <circle
            cx={padding + (hoverIndex / (points.length - 1)) * (width - 2 * padding)}
            cy={
              height -
              padding -
              ((points[hoverIndex].value - minVal) / range) * (height - 2 * padding)
            }
            r="1"
            fill={color}
          />
        )}
      </svg>
    </div>
  );
}
