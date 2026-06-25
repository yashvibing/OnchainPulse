"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  AnalyticsBar,
  AnalyticsPayload,
  AnalyticsPoint,
  AnalyticsStablecoin,
  AnalyticsValidator,
} from "@/services/analytics";

type Tone = "positive" | "negative" | "warning" | "neutral";
type ChartRange = "7d" | "30d" | "all";
type ChartMetricId = "price" | "dexVolume" | "fees" | "defiFlow";

interface ChartMetric {
  id: ChartMetricId;
  label: string;
  value: string;
  helper: string;
  color: string;
  points: AnalyticsPoint[];
  formatter: (value: number) => string;
}

const CHART_RANGES: Array<{ value: ChartRange; label: string; days?: number }> = [
  { value: "7d", label: "7D", days: 7 },
  { value: "30d", label: "30D", days: 30 },
  { value: "all", label: "All" },
];

function formatCurrency(value?: number, maximumFractionDigits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value > 0 && value < 0.01) return `$${value.toFixed(6)}`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits })}`;
}

function formatNumber(value?: number, digits = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatPercent(value?: number, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toFixed(digits)}%`;
}

function formatSignedPercent(value?: number, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatMon(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B MON`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M MON`;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} MON`;
}

function normalizeTimestampMs(value: number) {
  return value < 10_000_000_000 ? value * 1000 : value;
}

function formatShortDate(value?: number) {
  if (!value) return "-";
  return new Date(normalizeTimestampMs(value)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatFreshness(value?: number) {
  if (!value) return "waiting";
  const minutes = Math.max(0, Math.round((Date.now() - value) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function toneForPercent(value?: number): Tone {
  if (typeof value !== "number" || !Number.isFinite(value)) return "neutral";
  return value >= 0 ? "positive" : "negative";
}

function toneClasses(tone: Tone) {
  if (tone === "positive") return "border-[rgba(0,245,204,0.34)] bg-[rgba(0,245,204,0.07)] text-[var(--color-positive)]";
  if (tone === "negative") return "border-[rgba(255,180,171,0.34)] bg-[rgba(255,180,171,0.07)] text-[var(--color-negative)]";
  if (tone === "warning") return "border-[rgba(255,214,76,0.34)] bg-[rgba(255,214,76,0.07)] text-[var(--color-warning)]";
  return "border-[rgba(132,148,142,0.25)] bg-[rgba(255,255,255,0.025)] text-[var(--color-text-secondary)]";
}

function sortedPoints(points: AnalyticsPoint[]) {
  return [...points].sort((a, b) => normalizeTimestampMs(a.timestamp) - normalizeTimestampMs(b.timestamp));
}

function pointsForRange(points: AnalyticsPoint[], range: ChartRange) {
  const sorted = sortedPoints(points);
  const config = CHART_RANGES.find((item) => item.value === range);
  if (!config?.days || sorted.length === 0) return sorted;
  const latest = normalizeTimestampMs(sorted.at(-1)?.timestamp || 0);
  const cutoff = latest - config.days * 86_400_000;
  const filtered = sorted.filter((point) => normalizeTimestampMs(point.timestamp) >= cutoff);
  return filtered.length >= 2 ? filtered : sorted.slice(-Math.min(sorted.length, 2));
}

function chartCoordinates(points: AnalyticsPoint[], width = 100, height = 42, padding = 2) {
  if (points.length === 0) return [];
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const denominator = Math.max(1, points.length - 1);

  return points.map((point, index) => ({
    ...point,
    x: padding + (index / denominator) * (width - padding * 2),
    y: height - padding - ((point.value - min) / range) * (height - padding * 2),
  }));
}

function chartPath(points: AnalyticsPoint[]) {
  return chartCoordinates(points)
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
}

function changeForPoints(points: AnalyticsPoint[]) {
  if (points.length < 2) return undefined;
  const first = points[0]?.value;
  const last = points.at(-1)?.value;
  if (!first || typeof last !== "number") return undefined;
  return ((last - first) / Math.abs(first)) * 100;
}

function latestValue(points: AnalyticsPoint[]) {
  return sortedPoints(points).at(-1)?.value;
}

function buildChartMetrics(analytics: AnalyticsPayload, range: ChartRange): ChartMetric[] {
  const pricePoints = pointsForRange(analytics.market.priceTrend, range);
  const dexPoints = pointsForRange(analytics.dex.volumeTrend, range);
  const feePoints = pointsForRange(analytics.economy.feeTrend, range);
  const defiPoints = pointsForRange(analytics.defi.volume30dTrend, range);

  return [
    {
      id: "price",
      label: "MON price",
      value: formatCurrency(analytics.market.priceUsd, 6),
      helper: formatSignedPercent(changeForPoints(pricePoints)),
      color: "var(--color-accent-primary)",
      points: pricePoints,
      formatter: (value) => formatCurrency(value, 6),
    },
    {
      id: "dexVolume",
      label: "DEX volume",
      value: formatCurrency(analytics.dex.volume24hUsd),
      helper: "24h volume",
      color: "var(--color-accent-secondary)",
      points: dexPoints,
      formatter: formatCurrency,
    },
    {
      id: "fees",
      label: "Fees",
      value: formatCurrency(analytics.economy.dailyFeesUsd),
      helper: "daily fees",
      color: "var(--color-warning)",
      points: feePoints,
      formatter: formatCurrency,
    },
    {
      id: "defiFlow",
      label: "DeFi flow",
      value: formatCurrency(latestValue(analytics.defi.volume30dTrend)),
      helper: "latest daily flow",
      color: "var(--color-accent-violet)",
      points: defiPoints,
      formatter: formatCurrency,
    },
  ];
}

function buildInsights(analytics: AnalyticsPayload) {
  const insights: Array<{ title: string; body: string; tone: Tone }> = [];
  const dexDailyAverage = analytics.dex.volume7dUsd ? analytics.dex.volume7dUsd / 7 : undefined;
  const dexChange = analytics.dex.volume24hUsd && dexDailyAverage
    ? ((analytics.dex.volume24hUsd - dexDailyAverage) / dexDailyAverage) * 100
    : undefined;
  const feeDailyAverage = analytics.dex.fees7dUsd ? analytics.dex.fees7dUsd / 7 : undefined;
  const feeChange = analytics.economy.dailyFeesUsd && feeDailyAverage
    ? ((analytics.economy.dailyFeesUsd - feeDailyAverage) / feeDailyAverage) * 100
    : undefined;
  const topProtocol = analytics.dex.topProtocols[0];
  const topRate = analytics.defi.topRates[0];
  const topStable = analytics.stablecoins.assets[0];

  if (typeof dexChange === "number") {
    insights.push({
      title: dexChange >= 0 ? "DEX activity is above recent pace" : "DEX activity is below recent pace",
      body: `${formatCurrency(analytics.dex.volume24hUsd)} over 24h vs ${formatCurrency(dexDailyAverage)} daily average across 7d.`,
      tone: dexChange >= 15 ? "positive" : dexChange <= -15 ? "warning" : "neutral",
    });
  }

  if (typeof feeChange === "number") {
    insights.push({
      title: feeChange >= 0 ? "Fee capture is firmer" : "Fee capture is lighter",
      body: `${formatCurrency(analytics.economy.dailyFeesUsd)} daily fees vs ${formatCurrency(feeDailyAverage)} 7d daily average.`,
      tone: feeChange >= 20 ? "positive" : feeChange <= -20 ? "warning" : "neutral",
    });
  }

  if (topStable) {
    insights.push({
      title: `${topStable.symbol} anchors stablecoin liquidity`,
      body: `${formatCurrency(topStable.valueUsd)} supply, ${formatPercent(topStable.sharePct)} of tracked Monad stables.`,
      tone: topStable.sharePct > 70 ? "warning" : "neutral",
    });
  }

  if (analytics.decentralization.top10SharePct) {
    insights.push({
      title: "Validator stake concentration",
      body: `Top 10 validators hold ${formatPercent(analytics.decentralization.top10SharePct)} of active stake. Nakamoto safety is ${formatNumber(analytics.decentralization.nakamotoSafety)} validators.`,
      tone: analytics.decentralization.top10SharePct > 45 ? "warning" : "neutral",
    });
  }

  if (topProtocol) {
    insights.push({
      title: `${topProtocol.label} leads DEX volume`,
      body: `${formatCurrency(topProtocol.value)} tracked over the latest 24h window.`,
      tone: "neutral",
    });
  }

  if (topRate) {
    insights.push({
      title: "Displayed rates are actionable",
      body: `${topRate.label} is showing ${topRate.value.toFixed(2)}% APR from current yield sources.`,
      tone: topRate.value > 15 ? "positive" : "neutral",
    });
  }

  return insights.slice(0, 5);
}

async function loadAnalytics() {
  const response = await fetch("/api/analytics");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load analytics.");
  return data.data as AnalyticsPayload;
}

function ShellPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-[var(--radius-lg)] border border-[rgba(132,148,142,0.24)] bg-[rgba(13,21,18,0.78)] ${className}`}>
      {children}
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  aside,
}: {
  eyebrow?: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4 flex min-w-0 flex-wrap items-end justify-between gap-3 border-b border-[rgba(132,148,142,0.18)] pb-3">
      <div className="min-w-0">
        {eyebrow && <div className="label-caps text-[var(--color-accent-primary)]">{eyebrow}</div>}
        <h2 className="mt-2 truncate text-[18px] font-black leading-none text-[var(--color-text-primary)]">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

function MiniSparkline({ points, color }: { points: AnalyticsPoint[]; color: string }) {
  const sampled = sortedPoints(points).slice(-32);
  const path = sampled.length >= 2 ? chartPath(sampled) : "";

  return (
    <svg viewBox="0 0 100 42" preserveAspectRatio="none" className="h-10 w-full overflow-visible" aria-hidden="true">
      {path ? (
        <path d={path} fill="none" stroke={color} strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
      ) : (
        <path d="M4 28 L96 28" fill="none" stroke="rgba(132,148,142,0.32)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

function PulseCard({
  label,
  value,
  helper,
  tone = "neutral",
  points = [],
  color = "var(--color-accent-primary)",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: Tone;
  points?: AnalyticsPoint[];
  color?: string;
}) {
  return (
    <div className={`grid min-h-[126px] grid-rows-[auto_1fr_auto] rounded-[var(--radius-lg)] border p-3 ${toneClasses(tone)}`}>
      <div className="label-caps truncate text-current opacity-70">{label}</div>
      <div className="mt-3 min-w-0">
        <div className="truncate font-mono text-[24px] font-black leading-none text-[var(--color-text-primary)]">{value}</div>
        {helper && <div className="mt-2 truncate text-[12px] font-semibold text-[var(--color-text-muted)]">{helper}</div>}
      </div>
      <MiniSparkline points={points} color={color} />
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: Tone;
}) {
  return (
    <div className={`min-w-0 rounded-[var(--radius-md)] border px-3 py-3 ${toneClasses(tone)}`}>
      <div className="label-caps truncate text-current opacity-70">{label}</div>
      <div className="mt-2 truncate font-mono text-[17px] font-black leading-none text-[var(--color-text-primary)]">{value}</div>
      {helper && <div className="mt-1 truncate text-[11px] font-semibold text-[var(--color-text-muted)]">{helper}</div>}
    </div>
  );
}

function RangeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-[var(--radius-md)] border px-3 font-mono text-[11px] font-black transition-colors ${
        active
          ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-[#031713]"
          : "border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

function TrendChart({ metric }: { metric: ChartMetric }) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const coordinates = useMemo(() => chartCoordinates(metric.points), [metric.points]);
  const activePoint = activeIndex !== null ? coordinates[activeIndex] : coordinates.at(-1);
  const path = metric.points.length >= 2 ? chartPath(metric.points) : "";
  const areaPath = path ? `${path} L98,42 L2,42 Z` : "";

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (coordinates.length === 0 || !chartRef.current) return;
    const bounds = chartRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    setActiveIndex(Math.round(ratio * (coordinates.length - 1)));
  }

  if (!path) {
    return (
      <div className="grid h-[310px] place-items-center rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.22)] text-[13px] font-semibold text-[var(--color-text-muted)]">
        Trend unavailable
      </div>
    );
  }

  return (
    <div
      ref={chartRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setActiveIndex(null)}
      className="rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.22)] bg-[rgba(255,255,255,0.018)] p-3"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-caps text-[var(--color-text-dim)]">{activePoint ? formatShortDate(activePoint.timestamp) : "Latest"}</div>
          <div className="mt-1 font-mono text-[26px] font-black leading-none text-[var(--color-text-primary)]">
            {activePoint ? metric.formatter(activePoint.value) : metric.value}
          </div>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.24)] px-3 py-2 text-right">
          <div className="label-caps text-[var(--color-text-dim)]">{metric.label}</div>
          <div className="mt-1 text-[12px] font-bold text-[var(--color-text-secondary)]">{metric.helper}</div>
        </div>
      </div>

      <svg viewBox="0 0 100 42" preserveAspectRatio="none" className="h-[240px] w-full overflow-visible" aria-label={`${metric.label} trend`}>
        <defs>
          <linearGradient id={`area-${metric.id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={metric.color} stopOpacity="0.26" />
            <stop offset="100%" stopColor={metric.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M2 40 H98" stroke="rgba(132,148,142,0.18)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        <path d="M2 22 H98" stroke="rgba(132,148,142,0.1)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        <path d="M2 4 H98" stroke="rgba(132,148,142,0.1)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        <path d={areaPath} fill={`url(#area-${metric.id})`} />
        <path d={path} fill="none" stroke={metric.color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
        {activePoint && (
          <circle
            cx={activePoint.x}
            cy={activePoint.y}
            r="1.8"
            fill="var(--color-bg-primary)"
            stroke={metric.color}
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}

function BarList({
  items,
  formatter,
  limit = 6,
}: {
  items: AnalyticsBar[];
  formatter: (value: number) => string;
  limit?: number;
}) {
  const visible = items.slice(0, limit);
  const max = Math.max(...visible.map((item) => item.value), 1);

  if (visible.length === 0) {
    return <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-4 text-[12px] text-[var(--color-text-muted)]">No rows available.</div>;
  }

  return (
    <div className="space-y-3">
      {visible.map((item) => (
        <div key={`${item.label}-${item.value}`} className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
            <span className="min-w-0 truncate font-bold text-[var(--color-text-secondary)]">{item.label}</span>
            <span className="shrink-0 font-mono font-bold text-[var(--color-text-primary)]">{formatter(item.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[rgba(132,148,142,0.18)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent-primary)]"
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
          {item.detail && <div className="mt-1 truncate text-[11px] text-[var(--color-text-dim)]">{item.detail}</div>}
        </div>
      ))}
    </div>
  );
}

function StablecoinRows({ stablecoins }: { stablecoins: AnalyticsStablecoin[] }) {
  if (stablecoins.length === 0) return <div className="text-[12px] text-[var(--color-text-muted)]">No stablecoin rows available.</div>;

  return (
    <div className="space-y-2">
      {stablecoins.slice(0, 5).map((coin) => (
        <div key={coin.symbol} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.18)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
          <div className="min-w-0 truncate text-[13px] font-black text-[var(--color-text-primary)]">{coin.symbol}</div>
          <div className="font-mono text-[12px] font-bold text-[var(--color-text-secondary)]">{formatCurrency(coin.valueUsd)}</div>
          <div className="w-14 text-right font-mono text-[12px] font-bold text-[var(--color-text-muted)]">{formatPercent(coin.sharePct)}</div>
        </div>
      ))}
    </div>
  );
}

function ValidatorRows({ validators }: { validators: AnalyticsValidator[] }) {
  if (validators.length === 0) return <div className="text-[12px] text-[var(--color-text-muted)]">No validator rows available.</div>;

  return (
    <div className="space-y-2">
      {validators.slice(0, 6).map((validator) => (
        <div key={`${validator.rank}-${validator.id}`} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.18)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
          <div className="font-mono text-[11px] font-black text-[var(--color-text-dim)]">#{validator.rank}</div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-black text-[var(--color-text-primary)]">{validator.name}</div>
            <div className="mt-0.5 truncate text-[11px] text-[var(--color-text-dim)]">{formatMon(validator.stakeMon)}</div>
          </div>
          <div className="text-right font-mono text-[12px] font-black text-[var(--color-text-secondary)]">{formatPercent(validator.sharePct, 2)}</div>
        </div>
      ))}
    </div>
  );
}

function InsightList({ analytics }: { analytics: AnalyticsPayload }) {
  const insights = buildInsights(analytics);

  return (
    <div className="space-y-2">
      {insights.map((insight) => (
        <div key={insight.title} className={`rounded-[var(--radius-md)] border px-3 py-3 ${toneClasses(insight.tone)}`}>
          <div className="text-[13px] font-black text-[var(--color-text-primary)]">{insight.title}</div>
          <div className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-muted)]">{insight.body}</div>
        </div>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4">
      <div className="h-24 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)]" />
      <div className="grid gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
        ))}
      </div>
      <div className="h-[360px] animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
    </div>
  );
}

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>("30d");
  const [activeMetricId, setActiveMetricId] = useState<ChartMetricId>("dexVolume");

  useEffect(() => {
    let cancelled = false;

    loadAnalytics()
      .then((payload) => {
        if (cancelled) return;
        setAnalytics(payload);
        setError(null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load analytics.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const chartMetrics = useMemo(
    () => (analytics ? buildChartMetrics(analytics, chartRange) : []),
    [analytics, chartRange]
  );
  const activeMetric = chartMetrics.find((metric) => metric.id === activeMetricId) || chartMetrics[0];

  if (!analytics && !error) return <LoadingState />;

  if (error || !analytics || !activeMetric) {
    return (
      <ShellPanel className="px-5 py-8 text-center">
        <div className="text-[15px] font-black text-[var(--color-text-primary)]">{error || "Could not load analytics."}</div>
        <div className="mt-2 text-[12px] text-[var(--color-text-muted)]">The data API did not return a usable snapshot.</div>
      </ShellPanel>
    );
  }

  const tvl = analytics.defi.totalChainTvlUsd ?? analytics.defi.totalTvlUsd;
  const stableLeader = analytics.stablecoins.assets[0];
  const topRate = analytics.defi.topRates[0];
  const sourceLine = analytics.sources.join(" + ");

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="label-caps text-[var(--color-accent-primary)]">Monad analytics</div>
          <h1 className="mt-2 text-[30px] font-black leading-none text-[var(--color-text-primary)] md:text-[42px]">
            Liquidity, market flow, and validator risk
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[var(--color-text-muted)]">
          <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1">Updated {formatFreshness(analytics.generatedAt)}</span>
          <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1">Rolling windows only</span>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-5">
        <PulseCard
          label="MON price"
          value={formatCurrency(analytics.market.priceUsd, 6)}
          helper={`${formatSignedPercent(analytics.market.change24hPct)} 24h`}
          tone={toneForPercent(analytics.market.change24hPct)}
          points={analytics.market.priceTrend}
          color="var(--color-accent-primary)"
        />
        <PulseCard
          label="DEX volume"
          value={formatCurrency(analytics.dex.volume24hUsd)}
          helper={`${formatCurrency(analytics.dex.volume7dUsd)} 7d`}
          points={analytics.dex.volumeTrend}
          color="var(--color-accent-secondary)"
        />
        <PulseCard
          label="Chain TVL"
          value={formatCurrency(tvl)}
          helper={`${analytics.defi.protocolTvl.length} tracked protocols`}
          points={analytics.defi.volume30dTrend}
          color="var(--color-accent-violet)"
        />
        <PulseCard
          label="Stable liquidity"
          value={formatCurrency(analytics.stablecoins.totalUsd)}
          helper={stableLeader ? `${stableLeader.symbol} ${formatPercent(stableLeader.sharePct)}` : "tracked stables"}
          color="var(--color-warning)"
        />
        <PulseCard
          label="Active stake"
          value={formatMon(analytics.staking.totalActiveStakeMon)}
          helper={`${formatNumber(analytics.staking.activeValidators)} active validators`}
          color="var(--color-accent-primary)"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_420px]">
        <ShellPanel className="p-4">
          <SectionHeader
            eyebrow="Market pulse"
            title="Trend board"
            aside={
              <div className="flex flex-wrap gap-2">
                {CHART_RANGES.map((range) => (
                  <RangeButton key={range.value} active={chartRange === range.value} onClick={() => setChartRange(range.value)}>
                    {range.label}
                  </RangeButton>
                ))}
              </div>
            }
          />

          <div className="mb-3 grid gap-2 sm:grid-cols-4">
            {chartMetrics.map((metric) => (
              <button
                key={metric.id}
                type="button"
                onClick={() => setActiveMetricId(metric.id)}
                className={`min-w-0 rounded-[var(--radius-md)] border px-3 py-3 text-left transition-colors ${
                  activeMetric.id === metric.id
                    ? "border-[var(--color-accent-primary)] bg-[rgba(0,245,204,0.08)]"
                    : "border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] hover:border-[var(--color-border-hover)]"
                }`}
              >
                <div className="label-caps truncate text-[var(--color-text-dim)]">{metric.label}</div>
                <div className="mt-2 truncate font-mono text-[16px] font-black text-[var(--color-text-primary)]">{metric.value}</div>
                <div className="mt-1 truncate text-[11px] font-semibold text-[var(--color-text-muted)]">{metric.helper}</div>
              </button>
            ))}
          </div>

          <TrendChart metric={activeMetric} />
        </ShellPanel>

        <ShellPanel className="p-4">
          <SectionHeader eyebrow="Signals" title="What changed" />
          <InsightList analytics={analytics} />
        </ShellPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ShellPanel className="p-4">
          <SectionHeader eyebrow="Liquidity" title="DeFi depth" />
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Metric label="TVL" value={formatCurrency(tvl)} />
            <Metric label="Vol / TVL" value={formatPercent(analytics.dex.volumeToTvlPct)} />
          </div>
          <BarList items={analytics.defi.protocolTvl} formatter={formatCurrency} />
        </ShellPanel>

        <ShellPanel className="p-4">
          <SectionHeader eyebrow="Trading" title="DEX leaders" />
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Metric label="24h volume" value={formatCurrency(analytics.dex.volume24hUsd)} />
            <Metric label="24h fees" value={formatCurrency(analytics.dex.fees24hUsd ?? analytics.economy.dailyFeesUsd)} />
          </div>
          <BarList items={analytics.dex.topProtocols} formatter={formatCurrency} limit={6} />
        </ShellPanel>

        <ShellPanel className="p-4">
          <SectionHeader eyebrow="Stables" title="Liquidity base" />
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Metric label="Total" value={formatCurrency(analytics.stablecoins.totalUsd)} />
            <Metric label="Largest" value={stableLeader?.symbol || "-"} helper={stableLeader ? formatCurrency(stableLeader.valueUsd) : undefined} />
          </div>
          <StablecoinRows stablecoins={analytics.stablecoins.assets} />
        </ShellPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ShellPanel className="p-4">
          <SectionHeader eyebrow="Yield" title="Displayed rates" />
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Metric label="Top rate" value={topRate ? `${topRate.value.toFixed(2)}%` : "-"} helper={topRate?.label} tone={topRate && topRate.value > 15 ? "positive" : "neutral"} />
            <Metric label="Staking range" value={`${formatPercent(analytics.staking.minApyPct)} - ${formatPercent(analytics.staking.maxApyPct)}`} />
          </div>
          <BarList items={analytics.defi.topRates} formatter={(value) => `${value.toFixed(2)}% APR`} limit={7} />
        </ShellPanel>

        <ShellPanel className="p-4">
          <SectionHeader eyebrow="Validators" title="Stake distribution" />
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Metric label="Active" value={formatNumber(analytics.staking.activeValidators)} helper={`${formatNumber(analytics.staking.activeSetCap)} cap`} />
            <Metric label="Nakamoto 1/3" value={formatNumber(analytics.decentralization.nakamotoSafety)} />
            <Metric label="Top 10 stake" value={formatPercent(analytics.decentralization.top10SharePct)} tone={analytics.decentralization.top10SharePct && analytics.decentralization.top10SharePct > 45 ? "warning" : "neutral"} />
            <Metric label="Commission" value={formatPercent(analytics.staking.medianCommissionPct)} helper="median" />
          </div>
          <ValidatorRows validators={analytics.validators} />
        </ShellPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ShellPanel className="p-4 xl:col-span-2">
          <SectionHeader eyebrow="Network aggregate" title="Rolling activity" />
          <div className="grid gap-2 sm:grid-cols-3">
            <Metric label="Transactions 1h" value={formatNumber(analytics.network.transactions1h)} helper="rolling aggregate" />
            <Metric label="Blocks 1h" value={formatNumber(analytics.network.blocks1h)} helper="rolling aggregate" />
            <Metric label="Finality target" value={`${formatNumber(analytics.network.finalitySeconds, 1)}s`} helper="protocol reference" />
          </div>
        </ShellPanel>

        <ShellPanel className="p-4">
          <SectionHeader eyebrow="Sources" title="Provider memory" />
          <div className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">{sourceLine}</div>
        </ShellPanel>
      </div>
    </div>
  );
}
