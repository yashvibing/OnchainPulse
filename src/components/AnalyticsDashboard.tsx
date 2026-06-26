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
type ChartMetricId =
  | "price"
  | "marketCap"
  | "fdv"
  | "marketVolume"
  | "dexVolume"
  | "dexVolumeAverage"
  | "dexFees"
  | "dexFeesAverage"
  | "annualizedFees"
  | "chainTvl"
  | "dexTvl"
  | "stableLiquidity"
  | "stakedValue"
  | "stakingApy"
  | "activeValidators"
  | "nakamotoSafety"
  | "top10Stake"
  | "volumeToTvl"
  | "psRatio"
  | "pfRatio";
type DetailTab = "defi" | "yield" | "validators";

interface ChartMetric {
  id: ChartMetricId;
  label: string;
  value: string;
  helper: string;
  color: string;
  points: AnalyticsPoint[];
  formatter: (value: number) => string;
  tone?: Tone;
}

interface AnalyticsMeta {
  cache?: string;
  ageMs?: number;
  fetchedAt?: number;
  durationMs?: number;
  sources?: string[];
}

interface AnalyticsApiResponse {
  data: AnalyticsPayload;
  meta?: AnalyticsMeta;
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

function formatCacheStatus(meta?: AnalyticsMeta) {
  if (!meta?.cache) return "Fresh snapshot";
  if (meta.cache === "stale") return "Stale fallback";
  if (meta.cache === "hit") return "Cached";
  if (meta.cache === "miss") return "Fresh snapshot";
  return meta.cache;
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
  return coordinatesPath(chartCoordinates(points));
}

function coordinatesPath(coordinates: Array<{ x: number; y: number }>) {
  return coordinates
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

function scaleTrend(points: AnalyticsPoint[], multiplier?: number) {
  if (typeof multiplier !== "number" || !Number.isFinite(multiplier)) return [];
  return points.map((point) => ({
    timestamp: point.timestamp,
    value: point.value * multiplier,
  }));
}

function valueTrendFromPrice(points: AnalyticsPoint[], currentValue?: number, currentPrice?: number, supply?: number) {
  if (typeof currentValue === "number" && Number.isFinite(currentValue) && currentValue > 0 && currentPrice && currentPrice > 0) {
    return scaleTrend(points, currentValue / currentPrice);
  }
  return scaleTrend(points, supply);
}

function movingAverageTrend(points: AnalyticsPoint[], windowSize = 7) {
  const sorted = sortedPoints(points);
  return sorted.map((point, index) => {
    const window = sorted.slice(Math.max(0, index - windowSize + 1), index + 1);
    return {
      timestamp: point.timestamp,
      value: window.reduce((total, item) => total + item.value, 0) / window.length,
    };
  });
}

function buildChartMetrics(analytics: AnalyticsPayload, range: ChartRange): ChartMetric[] {
  const pricePoints = pointsForRange(analytics.market.priceTrend, range);
  const dexPoints = pointsForRange(analytics.dex.volumeTrend, range);
  const feePoints = pointsForRange(analytics.economy.feeTrend, range);
  const dexAveragePoints = movingAverageTrend(dexPoints);
  const feeAveragePoints = movingAverageTrend(feePoints);
  const marketCapPoints = valueTrendFromPrice(
    pricePoints,
    analytics.market.marketCapUsd,
    analytics.market.priceUsd,
    analytics.supply.circulatingSupplyMon
  );
  const fdvPoints = valueTrendFromPrice(
    pricePoints,
    analytics.market.fdvUsd,
    analytics.market.priceUsd,
    analytics.supply.totalSupplyMon
  );
  const annualizedFeePoints = scaleTrend(feePoints, 365);
  const topStable = analytics.stablecoins.assets[0];

  return [
    {
      id: "price",
      label: "MON price",
      value: formatCurrency(analytics.market.priceUsd, 6),
      helper: formatSignedPercent(changeForPoints(pricePoints)),
      color: "#2f81ff",
      points: pricePoints,
      formatter: (value) => formatCurrency(value, 6),
      tone: toneForPercent(changeForPoints(pricePoints)),
    },
    {
      id: "marketCap",
      label: "Market cap",
      value: formatCurrency(analytics.market.marketCapUsd),
      helper: "derived from MON price",
      color: "#ff2f7d",
      points: marketCapPoints,
      formatter: formatCurrency,
    },
    {
      id: "fdv",
      label: "FDV",
      value: formatCurrency(analytics.market.fdvUsd),
      helper: "fully diluted value",
      color: "#d22cff",
      points: fdvPoints,
      formatter: formatCurrency,
    },
    {
      id: "marketVolume",
      label: "Market volume",
      value: formatCurrency(analytics.market.volume24hUsd),
      helper: "24h token volume",
      color: "#8b5cf6",
      points: [],
      formatter: formatCurrency,
    },
    {
      id: "dexVolume",
      label: "DEX volume",
      value: formatCurrency(analytics.dex.volume24hUsd),
      helper: "24h volume",
      color: "#50c861",
      points: dexPoints,
      formatter: formatCurrency,
    },
    {
      id: "dexVolumeAverage",
      label: "DEX 7d avg",
      value: formatCurrency(latestValue(dexAveragePoints)),
      helper: "smoothed volume",
      color: "#9bd66b",
      points: dexAveragePoints,
      formatter: formatCurrency,
    },
    {
      id: "dexFees",
      label: "Chain fees",
      value: formatCurrency(analytics.economy.dailyFeesUsd),
      helper: "daily fees",
      color: "#c75323",
      points: feePoints,
      formatter: formatCurrency,
    },
    {
      id: "dexFeesAverage",
      label: "Fees 7d avg",
      value: formatCurrency(latestValue(feeAveragePoints)),
      helper: "smoothed fees",
      color: "#fb923c",
      points: feeAveragePoints,
      formatter: formatCurrency,
    },
    {
      id: "annualizedFees",
      label: "Annualized fees",
      value: formatCurrency(analytics.economy.annualizedFeesUsd),
      helper: "daily fees x 365",
      color: "#f59e0b",
      points: annualizedFeePoints,
      formatter: formatCurrency,
    },
    {
      id: "chainTvl",
      label: "Chain TVL",
      value: formatCurrency(analytics.defi.totalChainTvlUsd ?? analytics.defi.totalTvlUsd),
      helper: `${analytics.defi.protocolTvl.length} tracked protocols`,
      color: "#14b8a6",
      points: [],
      formatter: formatCurrency,
    },
    {
      id: "dexTvl",
      label: "DEX TVL",
      value: formatCurrency(analytics.dex.tvlUsd),
      helper: "tracked DEX liquidity",
      color: "#06b6d4",
      points: [],
      formatter: formatCurrency,
    },
    {
      id: "stableLiquidity",
      label: "Stablecoins mcap",
      value: formatCurrency(analytics.stablecoins.totalUsd),
      helper: topStable ? `${topStable.symbol} ${formatPercent(topStable.sharePct)}` : "tracked stables",
      color: "#ec4899",
      points: [],
      formatter: formatCurrency,
    },
    {
      id: "stakedValue",
      label: "Staked value",
      value: formatCurrency(analytics.staking.totalValueStakedUsd),
      helper: formatMon(analytics.staking.totalActiveStakeMon),
      color: "#a78bfa",
      points: [],
      formatter: formatCurrency,
    },
    {
      id: "stakingApy",
      label: "Staking APY",
      value: formatPercent(analytics.staking.estimatedApyPct),
      helper: `${formatPercent(analytics.staking.minApyPct)} - ${formatPercent(analytics.staking.maxApyPct)}`,
      color: "#84cc16",
      points: [],
      formatter: (value) => formatPercent(value),
      tone: analytics.staking.estimatedApyPct && analytics.staking.estimatedApyPct > 8 ? "positive" : "neutral",
    },
    {
      id: "activeValidators",
      label: "Validators",
      value: formatNumber(analytics.staking.activeValidators),
      helper: `${formatNumber(analytics.staking.activeSetCap)} active cap`,
      color: "#22c55e",
      points: [],
      formatter: formatNumber,
    },
    {
      id: "nakamotoSafety",
      label: "Nakamoto safety",
      value: formatNumber(analytics.decentralization.nakamotoSafety),
      helper: "validators for 1/3 stake",
      color: "#38bdf8",
      points: [],
      formatter: formatNumber,
    },
    {
      id: "top10Stake",
      label: "Top 10 stake",
      value: formatPercent(analytics.decentralization.top10SharePct),
      helper: "validator concentration",
      color: "#fb7185",
      points: [],
      formatter: (value) => formatPercent(value),
      tone: analytics.decentralization.top10SharePct && analytics.decentralization.top10SharePct > 45 ? "warning" : "neutral",
    },
    {
      id: "volumeToTvl",
      label: "Volume / TVL",
      value: formatPercent(analytics.dex.volumeToTvlPct),
      helper: "DEX capital velocity",
      color: "#f97316",
      points: [],
      formatter: (value) => formatPercent(value),
    },
    {
      id: "psRatio",
      label: "P/S",
      value: formatNumber(analytics.economy.psRatio, 1),
      helper: "market cap / annual fees",
      color: "#facc15",
      points: [],
      formatter: (value) => formatNumber(value, 1),
    },
    {
      id: "pfRatio",
      label: "P/F",
      value: formatNumber(analytics.economy.pfRatio, 1),
      helper: "market cap / fee run-rate",
      color: "#fb923c",
      points: [],
      formatter: (value) => formatNumber(value, 1),
    },
  ];
}

async function loadAnalytics() {
  const response = await fetch("/api/analytics");
  const data = await response.json() as AnalyticsApiResponse & { error?: string };
  if (!response.ok) throw new Error(data.error || "Could not load analytics.");
  return data as AnalyticsApiResponse;
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
      aria-pressed={active}
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

function DetailTabButton({
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
      aria-pressed={active}
      onClick={onClick}
      className={`h-9 rounded-[var(--radius-md)] border px-4 text-[12px] font-black transition-colors ${
        active
          ? "border-[var(--color-accent-primary)] bg-[rgba(0,245,204,0.1)] text-[var(--color-accent-primary)]"
          : "border-[rgba(132,148,142,0.2)] bg-[rgba(255,255,255,0.018)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

function MetricPill({
  metric,
  selected,
  onClick,
}: {
  metric: ChartMetric;
  selected: boolean;
  onClick: () => void;
}) {
  const canChart = metric.points.length >= 2;

  return (
    <button
      type="button"
      disabled={!canChart}
      aria-pressed={selected}
      onClick={onClick}
      className={`flex h-9 max-w-full items-center gap-2 rounded-full border px-3 text-[12px] font-black transition-colors ${
        canChart
          ? "bg-[rgba(255,255,255,0.025)] text-[var(--color-text-primary)] hover:bg-[rgba(255,255,255,0.05)]"
          : "cursor-not-allowed border-[rgba(132,148,142,0.16)] bg-[rgba(255,255,255,0.012)] text-[var(--color-text-dim)]"
      }`}
      style={{
        borderColor: selected ? metric.color : undefined,
        boxShadow: selected ? `inset 0 0 0 1px ${metric.color}` : undefined,
      }}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: metric.color }} />
      <span className="truncate">{metric.label}</span>
      {selected && <span className="font-mono text-[14px] leading-none" aria-hidden="true">x</span>}
    </button>
  );
}

function MetricShelfTile({
  metric,
  selected,
  onClick,
}: {
  metric: ChartMetric;
  selected: boolean;
  onClick: () => void;
}) {
  const canChart = metric.points.length >= 2;
  const content = (
    <>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="label-caps min-w-0 truncate text-current opacity-70">{metric.label}</div>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: metric.color }} />
      </div>
      <div className="mt-2 truncate font-mono text-[17px] font-black leading-none text-[var(--color-text-primary)]">{metric.value}</div>
      <div className="mt-1 truncate text-[11px] font-semibold text-[var(--color-text-muted)]">{metric.helper}</div>
    </>
  );

  if (!canChart) {
    return (
      <div className={`min-w-0 rounded-[var(--radius-md)] border px-3 py-3 ${toneClasses(metric.tone || "neutral")}`}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-w-0 rounded-[var(--radius-md)] border px-3 py-3 text-left transition-colors ${
        selected
          ? "bg-[rgba(255,255,255,0.045)]"
          : "bg-[rgba(255,255,255,0.018)] hover:bg-[rgba(255,255,255,0.04)]"
      }`}
      style={{ borderColor: selected ? metric.color : "rgba(132,148,142,0.22)" }}
    >
      {content}
    </button>
  );
}

function MultiMetricChart({ metrics }: { metrics: ChartMetric[] }) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const chartableMetrics = metrics.filter((metric) => metric.points.length >= 2);
  const activeRatio = hoverRatio ?? 1;
  const primaryPoints = sortedPoints(chartableMetrics[0]?.points || []);
  const firstPoint = primaryPoints[0];
  const middlePoint = primaryPoints[Math.floor(primaryPoints.length / 2)];
  const lastPoint = primaryPoints.at(-1);
  const activeRows = chartableMetrics.map((metric) => {
    const points = sortedPoints(metric.points);
    const index = Math.min(points.length - 1, Math.max(0, Math.round(activeRatio * (points.length - 1))));
    return {
      metric,
      point: points[index],
    };
  });
  const activeDate = activeRows[0]?.point?.timestamp;

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (chartableMetrics.length === 0 || !chartRef.current) return;
    const bounds = chartRef.current.getBoundingClientRect();
    setHoverRatio(Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)));
  }

  if (chartableMetrics.length === 0) {
    return (
      <div className="grid h-[310px] place-items-center rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.22)] text-[13px] font-semibold text-[var(--color-text-muted)]">
        Select a chartable metric
      </div>
    );
  }

  return (
    <div
      ref={chartRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHoverRatio(null)}
      className="relative rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.22)] bg-[rgba(255,255,255,0.018)] p-3"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.24)] px-3 py-2">
          <div className="label-caps text-[var(--color-text-dim)]">Relative trend</div>
          <div className="mt-1 font-mono text-[13px] font-black text-[var(--color-text-primary)]">{activeDate ? formatShortDate(activeDate) : "Latest"}</div>
        </div>
        <div className="grid max-w-full grid-cols-2 gap-x-4 gap-y-1 rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.24)] px-3 py-2 md:grid-cols-3 xl:grid-cols-5">
          {activeRows.slice(0, 6).map(({ metric, point }) => (
            <div key={metric.id} className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: metric.color }} />
                <span className="truncate text-[10px] font-bold text-[var(--color-text-muted)]">{metric.label}</span>
              </div>
              <div className="truncate font-mono text-[12px] font-black text-[var(--color-text-primary)]">
                {point ? metric.formatter(point.value) : metric.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <svg
        viewBox="0 0 100 56"
        preserveAspectRatio="none"
        className="h-[320px] w-full overflow-visible md:h-[360px]"
        role="img"
        aria-label="Selected analytics metric comparison"
      >
        <defs>
          <linearGradient id="comparison-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={chartableMetrics[0]?.color || "var(--color-accent-primary)"} stopOpacity="0.18" />
            <stop offset="100%" stopColor={chartableMetrics[0]?.color || "var(--color-accent-primary)"} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[52, 40, 28, 16, 4].map((y) => (
          <path key={y} d={`M2 ${y} H98`} stroke="rgba(132,148,142,0.12)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
        ))}
        {chartableMetrics.map((metric, index) => {
          const coordinates = chartCoordinates(sortedPoints(metric.points), 100, 56, 3);
          const path = coordinatesPath(coordinates);
          const activeIndex = Math.min(coordinates.length - 1, Math.max(0, Math.round(activeRatio * (coordinates.length - 1))));
          const activePoint = coordinates[activeIndex];
          const areaPath = index === 0 && path ? `${path} L98,54 L2,54 Z` : "";
          return (
            <g key={metric.id}>
              {areaPath && <path d={areaPath} fill="url(#comparison-area)" />}
              <path
                d={path}
                fill="none"
                stroke={metric.color}
                strokeWidth={index === 0 ? "2.3" : "2"}
                opacity={index === 0 ? 1 : 0.86}
                vectorEffect="non-scaling-stroke"
              />
              {activePoint && (
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="1.5"
                  fill="var(--color-bg-primary)"
                  stroke={metric.color}
                  strokeWidth="1.3"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          );
        })}
        {hoverRatio !== null && (
          <path
            d={`M${(activeRatio * 100).toFixed(2)} 3 V53`}
            stroke="rgba(219,229,224,0.32)"
            strokeDasharray="2 2"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[10px] font-bold text-[var(--color-text-dim)]">
        <span>{formatShortDate(firstPoint?.timestamp)}</span>
        <span className="text-center">{formatShortDate(middlePoint?.timestamp)}</span>
        <span className="text-right">{formatShortDate(lastPoint?.timestamp)}</span>
      </div>
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

function LoadingState() {
  return (
    <div className="grid gap-4">
      <div className="h-24 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
        ))}
      </div>
      <div className="h-[360px] animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
    </div>
  );
}

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [meta, setMeta] = useState<AnalyticsMeta | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>("30d");
  const [selectedMetricIds, setSelectedMetricIds] = useState<ChartMetricId[]>([
    "price",
    "dexVolume",
    "dexVolumeAverage",
    "dexFees",
    "dexFeesAverage",
  ]);
  const [showMetricShelf, setShowMetricShelf] = useState(true);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>("defi");

  useEffect(() => {
    let cancelled = false;

    loadAnalytics()
      .then((result) => {
        if (cancelled) return;
        setAnalytics(result.data);
        setMeta(result.meta);
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
  const chartableMetrics = chartMetrics.filter((metric) => metric.points.length >= 2);
  const selectedMetrics = chartMetrics.filter((metric) => selectedMetricIds.includes(metric.id) && metric.points.length >= 2);
  const comparisonMetrics = selectedMetrics.length > 0 ? selectedMetrics : chartableMetrics.slice(0, 4);

  function toggleMetric(metric: ChartMetric) {
    if (metric.points.length < 2) return;
    setSelectedMetricIds((current) => {
      if (current.includes(metric.id)) {
        const next = current.filter((id) => id !== metric.id);
        return next.length > 0 ? next : current;
      }
      return [...current, metric.id];
    });
  }

  if (!analytics && !error) return <LoadingState />;

  if (error || !analytics) {
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
  const sourceLine = (meta?.sources || analytics.sources).join(" + ");
  const freshnessAnchor = meta?.fetchedAt || analytics.generatedAt;

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
          <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1">Updated {formatFreshness(freshnessAnchor)}</span>
          <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1">{formatCacheStatus(meta)}</span>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
      </div>

      <div className="grid gap-4">
        <ShellPanel className="p-4">
          <SectionHeader
            eyebrow="Market pulse"
            title="Metric comparison"
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

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMetricShelf((current) => !current)}
              aria-expanded={showMetricShelf}
              className="flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.22)] bg-[rgba(255,255,255,0.025)] px-3 text-[12px] font-black text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-hover)]"
            >
              Add metrics
              <span className="font-mono text-[16px] leading-none">+</span>
            </button>
            {comparisonMetrics.map((metric) => (
              <MetricPill
                key={metric.id}
                metric={metric}
                selected={selectedMetricIds.includes(metric.id) && metric.points.length >= 2}
                onClick={() => toggleMetric(metric)}
              />
            ))}
          </div>

          <MultiMetricChart metrics={comparisonMetrics} />

          {showMetricShelf && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              {chartMetrics.map((metric) => (
                <MetricShelfTile
                  key={metric.id}
                  metric={metric}
                  selected={selectedMetricIds.includes(metric.id) && metric.points.length >= 2}
                  onClick={() => toggleMetric(metric)}
                />
              ))}
            </div>
          )}
        </ShellPanel>
      </div>

      <ShellPanel className="p-4">
        <div className="mb-4 flex flex-col gap-3 border-b border-[rgba(132,148,142,0.18)] pb-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="label-caps text-[var(--color-accent-primary)]">Details</div>
            <h2 className="mt-2 text-[18px] font-black leading-none text-[var(--color-text-primary)]">
              {activeDetailTab === "defi" ? "DeFi depth" : activeDetailTab === "yield" ? "Displayed yield" : "Validator distribution"}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Analytics detail sections">
            <DetailTabButton active={activeDetailTab === "defi"} onClick={() => setActiveDetailTab("defi")}>
              DeFi
            </DetailTabButton>
            <DetailTabButton active={activeDetailTab === "yield"} onClick={() => setActiveDetailTab("yield")}>
              Yield
            </DetailTabButton>
            <DetailTabButton active={activeDetailTab === "validators"} onClick={() => setActiveDetailTab("validators")}>
              Validators
            </DetailTabButton>
          </div>
        </div>

        {activeDetailTab === "defi" && (
          <div className="grid gap-4 xl:grid-cols-3">
            <div>
              <div className="mb-4 grid grid-cols-2 gap-2">
                <Metric label="TVL" value={formatCurrency(tvl)} />
                <Metric label="Vol / TVL" value={formatPercent(analytics.dex.volumeToTvlPct)} />
              </div>
              <BarList items={analytics.defi.protocolTvl} formatter={formatCurrency} />
            </div>
            <div>
              <div className="mb-4 grid grid-cols-2 gap-2">
                <Metric label="24h volume" value={formatCurrency(analytics.dex.volume24hUsd)} />
                <Metric label="24h fees" value={formatCurrency(analytics.dex.fees24hUsd ?? analytics.economy.dailyFeesUsd)} />
              </div>
              <BarList items={analytics.dex.topProtocols} formatter={formatCurrency} limit={6} />
            </div>
            <div>
              <div className="mb-4 grid grid-cols-2 gap-2">
                <Metric label="Stables" value={formatCurrency(analytics.stablecoins.totalUsd)} />
                <Metric label="Largest" value={stableLeader?.symbol || "-"} helper={stableLeader ? formatCurrency(stableLeader.valueUsd) : undefined} />
              </div>
              <StablecoinRows stablecoins={analytics.stablecoins.assets} />
            </div>
          </div>
        )}

        {activeDetailTab === "yield" && (
          <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <Metric label="Top rate" value={topRate ? `${topRate.value.toFixed(2)}%` : "-"} helper={topRate?.label} tone={topRate && topRate.value > 15 ? "positive" : "neutral"} />
              <Metric label="Staking range" value={`${formatPercent(analytics.staking.minApyPct)} - ${formatPercent(analytics.staking.maxApyPct)}`} />
              <Metric label="30d DeFi flow" value={formatCurrency(analytics.dex.volume30dUsd)} helper="DEX volume" />
            </div>
            <BarList items={analytics.defi.topRates} formatter={(value) => `${value.toFixed(2)}% APR`} limit={7} />
          </div>
        )}

        {activeDetailTab === "validators" && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                <Metric label="Active" value={formatNumber(analytics.staking.activeValidators)} helper={`${formatNumber(analytics.staking.activeSetCap)} cap`} />
                <Metric label="Active stake" value={formatMon(analytics.staking.totalActiveStakeMon)} />
                <Metric label="Nakamoto 1/3" value={formatNumber(analytics.decentralization.nakamotoSafety)} />
                <Metric label="Top 10 stake" value={formatPercent(analytics.decentralization.top10SharePct)} tone={analytics.decentralization.top10SharePct && analytics.decentralization.top10SharePct > 45 ? "warning" : "neutral"} />
              </div>
              <ValidatorRows validators={analytics.validators} />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <div>
                <div className="mb-2 text-[12px] font-black text-[var(--color-text-secondary)]">Countries</div>
                <BarList items={analytics.decentralization.countries} formatter={(value) => formatPercent(value, 1)} limit={5} />
              </div>
              <div>
                <div className="mb-2 text-[12px] font-black text-[var(--color-text-secondary)]">Infrastructure</div>
                <BarList items={analytics.decentralization.providers} formatter={(value) => formatPercent(value, 1)} limit={5} />
              </div>
            </div>
          </div>
        )}
      </ShellPanel>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(132,148,142,0.18)] pt-3 text-[11px] text-[var(--color-text-dim)]">
        <span>{sourceLine}</span>
        {typeof meta?.durationMs === "number" && <span>{formatNumber(meta.durationMs)}ms API</span>}
      </div>
    </div>
  );
}
