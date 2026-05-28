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

interface ChartRanges {
  day: ChartPoint[];
  week: ChartPoint[];
  month: ChartPoint[];
}

async function fetchPriceHistory(): Promise<ChartRanges | null> {
  try {
    const res = await fetch("/api/mon-price-history");
    if (!res.ok) return null;
    const data = await res.json();
    if (data.ranges) {
      return {
        day: Array.isArray(data.ranges.day) ? data.ranges.day : [],
        week: Array.isArray(data.ranges.week) ? data.ranges.week : [],
        month: Array.isArray(data.ranges.month) ? data.ranges.month : [],
      };
    }
    const week = Array.isArray(data.data) ? data.data : [];
    return { day: week.slice(-24), week, month: week };
  } catch {
    return null;
  }
}

export function PortfolioSparkline({ holdings }: SparklineProps) {
  const [chartRanges, setChartRanges] = useState<ChartRanges | null>(null);

  useEffect(() => {
    fetchPriceHistory().then((historyRanges) => {
      if (!historyRanges) return;

      // Calculate total MON-denominated holdings
      // For simplicity, we scale the MON price curve by the portfolio's MON exposure
      const allPoints = [
        ...historyRanges.day,
        ...historyRanges.week,
        ...historyRanges.month,
      ];
      if (allPoints.length === 0) return;

      const currentMonPrice = allPoints[allPoints.length - 1]?.value || 1;
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

      function scale(points: ChartPoint[]) {
        return points.map((p) => ({
          timestamp: p.timestamp,
          value: monUnits * p.value + stableHoldings,
        }));
      }

      setChartRanges({
        day: scale(historyRanges.day),
        week: scale(historyRanges.week),
        month: scale(historyRanges.month),
      });
    });
  }, [holdings]);

  const ranges = [
    { label: "24H TREND", points: chartRanges?.day || [] },
    { label: "7-DAY TREND", points: chartRanges?.week || [] },
    { label: "30-DAY TREND", points: chartRanges?.month || [] },
  ];

  if (ranges.every((range) => range.points.length < 2)) return null;

  return (
    <div className="mb-5 grid gap-3 lg:grid-cols-3">
      {ranges.map((range) => (
        <TrendChart key={range.label} label={range.label} points={range.points} />
      ))}
    </div>
  );
}

function TrendChart({ label, points }: { label: string; points: ChartPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradientId = `spark-fill-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

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
    <div className="card px-4 py-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] tracking-[0.6px] text-[var(--color-text-muted)]">
          {label}
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
        style={{ height: 70 }}
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
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
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
