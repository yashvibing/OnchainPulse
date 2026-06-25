"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type {
  AnalyticsBar,
  AnalyticsPayload,
  AnalyticsPoint,
  AnalyticsStablecoin,
  AnalyticsValidator,
} from "@/services/analytics";

type Tone = "positive" | "negative" | "warning" | "neutral";
type ChartRange = "24h" | "7d" | "30d" | "all";
type ChartMetricId = "price" | "dexVolume" | "fees" | "defiVolume";

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
  { value: "24h", label: "24H", days: 1 },
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

function formatMon(value?: number, compact = true) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (compact && value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B MON`;
  if (compact && value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M MON`;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} MON`;
}

function formatNumber(value?: number, digits = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatPercent(value?: number, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toFixed(digits)}%`;
}

function formatSignedPercent(value?: number, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function normalizeTimestampMs(value: number) {
  return value < 10_000_000_000 ? value * 1000 : value;
}

function formatDateTime(value?: number) {
  if (!value) return "-";
  return new Date(normalizeTimestampMs(value)).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(value?: number) {
  if (!value) return "-";
  const minutes = Math.max(0, Math.round((Date.now() - value) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function percentTone(value?: number): Tone {
  if (typeof value !== "number" || !Number.isFinite(value)) return "neutral";
  return value >= 0 ? "positive" : "negative";
}

function toneClasses(tone: Tone) {
  if (tone === "positive") return "border-[rgba(0,245,204,0.36)] bg-[rgba(0,245,204,0.075)] text-[var(--color-positive)]";
  if (tone === "negative") return "border-[rgba(255,180,171,0.36)] bg-[rgba(255,180,171,0.075)] text-[var(--color-negative)]";
  if (tone === "warning") return "border-[rgba(255,214,76,0.36)] bg-[rgba(255,214,76,0.075)] text-[var(--color-warning)]";
  return "border-[rgba(132,148,142,0.24)] bg-[rgba(255,255,255,0.025)] text-[var(--color-text-secondary)]";
}

function pointsForRange(points: AnalyticsPoint[], range: ChartRange) {
  const sorted = [...points].sort((a, b) => normalizeTimestampMs(a.timestamp) - normalizeTimestampMs(b.timestamp));
  const rangeConfig = CHART_RANGES.find((item) => item.value === range);
  if (!rangeConfig?.days || sorted.length === 0) return sorted;

  const latest = Math.max(...sorted.map((point) => normalizeTimestampMs(point.timestamp)));
  const cutoff = latest - rangeConfig.days * 86_400_000;
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
      helper: "24h",
      color: "var(--color-accent-secondary)",
      points: dexPoints,
      formatter: formatCurrency,
    },
    {
      id: "fees",
      label: "Network fees",
      value: formatCurrency(analytics.economy.dailyFeesUsd),
      helper: "daily",
      color: "var(--color-warning)",
      points: feePoints,
      formatter: formatCurrency,
    },
    {
      id: "defiVolume",
      label: "DeFi flow",
      value: formatCurrency(analytics.defi.volume30dTrend.at(-1)?.value),
      helper: "latest",
      color: "var(--color-accent-violet)",
      points: defiPoints,
      formatter: formatCurrency,
    },
  ];
}

async function loadAnalytics() {
  const response = await fetch("/api/analytics");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load analytics.");
  return data.data as AnalyticsPayload;
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
      <div className="label-caps text-current opacity-70">{label}</div>
      <div className="mt-2 truncate font-mono text-[18px] font-black leading-none text-[var(--color-text-primary)]">
        {value}
      </div>
      {helper && <div className="mt-1 truncate text-[11px] font-semibold text-[var(--color-text-muted)]">{helper}</div>}
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-[var(--radius-lg)] border border-[rgba(132,148,142,0.26)] bg-[rgba(13,21,18,0.72)] p-4">
      <div className="mb-4 flex items-end justify-between gap-3 border-b border-[rgba(132,148,142,0.2)] pb-3">
        <div className="min-w-0">
          {eyebrow && <div className="label-caps text-[var(--color-accent-primary)]">{eyebrow}</div>}
          <h2 className="mt-2 truncate text-[18px] font-black leading-none text-[var(--color-text-primary)]">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function LineChart({
  metric,
  heightClass = "h-[280px]",
}: {
  metric: ChartMetric;
  heightClass?: string;
}) {
  const gradientId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const line = metric.points.length >= 2 ? chartPath(metric.points) : "";
  const area = line ? `${line} L98,42 L2,42 Z` : "";
  const coordinates = useMemo(() => chartCoordinates(metric.points), [metric.points]);
  const activePoint = activeIndex !== null ? coordinates[activeIndex] : coordinates.at(-1);
  const tooltipLeft =
    !activePoint ? "50%" : activePoint.x < 18 ? "12px" : activePoint.x > 82 ? "calc(100% - 12px)" : `${activePoint.x}%`;
  const tooltipTransform =
    !activePoint ? "translateX(-50%)" : activePoint.x < 18 ? "translateX(0)" : activePoint.x > 82 ? "translateX(-100%)" : "translateX(-50%)";

  if (!line) {
    return (
      <div className={`flex ${heightClass} items-center justify-center rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.22)] text-[13px] text-[var(--color-text-muted)]`}>
        Chart unavailable.
      </div>
    );
  }

  return (
    <div className={`relative ${heightClass}`}>
      <svg
        viewBox="0 0 100 42"
        className="h-full w-full rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.22)] bg-[rgba(8,16,13,0.42)]"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${metric.label} chart`}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
          setActiveIndex(Math.round(ratio * (coordinates.length - 1)));
        }}
        onPointerLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={metric.color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={metric.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0,10.5 H100 M0,21 H100 M0,31.5 H100" stroke="rgba(255,255,255,0.07)" strokeWidth="0.35" />
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={metric.color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        {activePoint && (
          <g>
            <line x1={activePoint.x} x2={activePoint.x} y1="2" y2="40" stroke="rgba(255,255,255,0.24)" strokeWidth="0.45" vectorEffect="non-scaling-stroke" />
            <circle cx={activePoint.x} cy={activePoint.y} r="1.35" fill="var(--color-bg-surface-solid)" stroke={metric.color} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
          </g>
        )}
      </svg>
      {activePoint && (
        <div
          className="pointer-events-none absolute top-3 z-[2] max-w-[calc(100%-24px)] rounded-[var(--radius-sm)] border border-[rgba(255,255,255,0.14)] bg-[rgba(8,16,13,0.92)] px-3 py-2 shadow-[0_14px_34px_rgba(0,0,0,0.38)]"
          style={{ left: tooltipLeft, transform: tooltipTransform }}
        >
          <div className="font-mono text-[13px] font-black leading-none text-[var(--color-text-primary)]">
            {metric.formatter(activePoint.value)}
          </div>
          <div className="mt-1 whitespace-nowrap text-[11px] font-semibold leading-none text-[var(--color-text-muted)]">
            {formatDateTime(activePoint.timestamp)}
          </div>
        </div>
      )}
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
    return <div className="text-[13px] text-[var(--color-text-muted)]">No data available.</div>;
  }

  return (
    <div className="space-y-2">
      {visible.map((item) => (
        <div key={item.label} className="grid min-w-0 gap-2 rounded-[var(--radius-sm)] py-1 sm:grid-cols-[minmax(0,1fr)_96px_auto] sm:items-center">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold text-[var(--color-text-primary)]">{item.label}</div>
            {item.detail && <div className="truncate text-[11px] text-[var(--color-text-muted)]">{item.detail}</div>}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-accent-primary),var(--color-accent-violet))]"
              style={{ width: `${Math.max(3, Math.min(100, (item.value / max) * 100))}%` }}
            />
          </div>
          <div className="font-mono text-[12px] font-bold text-[var(--color-text-secondary)] sm:text-right">
            {formatter(item.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ValidatorTable({ validators }: { validators: AnalyticsValidator[] }) {
  if (validators.length === 0) {
    return <div className="text-[13px] text-[var(--color-text-muted)]">Validator data unavailable.</div>;
  }

  return (
    <div className="max-h-[336px] overflow-auto">
      <table className="w-full min-w-[560px] text-left text-[13px]">
        <thead className="sticky top-0 bg-[rgba(13,21,18,0.96)]">
          <tr className="border-b border-[rgba(132,148,142,0.24)] text-[var(--color-text-dim)]">
            <th className="py-2 pr-3 font-semibold">#</th>
            <th className="py-2 pr-3 font-semibold">Validator</th>
            <th className="py-2 pr-3 text-right font-semibold">Stake</th>
            <th className="py-2 pr-3 text-right font-semibold">Share</th>
            <th className="py-2 pr-1 text-right font-semibold">Fee</th>
          </tr>
        </thead>
        <tbody>
          {validators.map((validator) => (
            <tr key={`${validator.id}-${validator.rank}`} className="border-b border-[rgba(255,255,255,0.055)]">
              <td className="py-2 pr-3 font-mono text-[var(--color-text-muted)]">{validator.rank}</td>
              <td className="max-w-[220px] truncate py-2 pr-3 font-bold text-[var(--color-text-primary)]">{validator.name}</td>
              <td className="py-2 pr-3 text-right font-mono text-[var(--color-text-secondary)]">{formatMon(validator.stakeMon)}</td>
              <td className="py-2 pr-3 text-right font-mono text-[var(--color-text-secondary)]">{formatPercent(validator.sharePct, 2)}</td>
              <td className="py-2 pr-1 text-right font-mono text-[var(--color-text-secondary)]">{formatPercent(validator.commissionPct, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StablecoinTable({ stablecoins }: { stablecoins: AnalyticsStablecoin[] }) {
  if (stablecoins.length === 0) {
    return <div className="text-[13px] text-[var(--color-text-muted)]">Stablecoin data unavailable.</div>;
  }

  return (
    <div className="space-y-2">
      {stablecoins.slice(0, 5).map((asset) => (
        <div key={asset.symbol} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-[rgba(255,255,255,0.055)] pb-2">
          <div className="truncate text-[13px] font-bold text-[var(--color-text-primary)]">{asset.symbol}</div>
          <div className="font-mono text-[12px] text-[var(--color-text-secondary)]">{formatCurrency(asset.valueUsd)}</div>
          <div className="font-mono text-[12px] text-[var(--color-text-muted)]">{formatPercent(asset.sharePct, 1)}</div>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [chartRange, setChartRange] = useState<ChartRange>("30d");
  const [chartMetricId, setChartMetricId] = useState<ChartMetricId>("price");
  const [lastFetchedAt, setLastFetchedAt] = useState(0);

  const refreshAnalytics = useCallback((silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");

    loadAnalytics()
      .then((next) => {
        setAnalytics(next);
        setLastFetchedAt(Date.now());
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load analytics."))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    refreshAnalytics();
    const interval = window.setInterval(() => refreshAnalytics(true), 60_000);
    return () => window.clearInterval(interval);
  }, [refreshAnalytics]);

  const chartMetrics = useMemo(
    () => (analytics ? buildChartMetrics(analytics, chartRange) : []),
    [analytics, chartRange]
  );
  const activeChart = chartMetrics.find((metric) => metric.id === chartMetricId) || chartMetrics[0];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
        <div className="h-[380px] animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-72 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
          <div className="h-72 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
          <div className="h-72 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
        </div>
      </div>
    );
  }

  if (error || !analytics || !activeChart) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[rgba(255,214,76,0.42)] bg-[rgba(255,214,76,0.08)] px-5 py-6 text-[14px] text-[var(--color-warning)]">
        {error || "Could not load analytics."}
      </div>
    );
  }

  const tvl = analytics.defi.totalChainTvlUsd ?? analytics.defi.totalTvlUsd;
  const dataFresh = Date.now() - analytics.generatedAt < 15 * 60_000;
  const sourceLine = analytics.sources.join(" + ");

  return (
    <div className="min-w-0 space-y-4 pb-8">
      <div className="flex min-w-0 flex-col gap-3 rounded-[var(--radius-lg)] border border-[rgba(132,148,142,0.26)] bg-[rgba(13,21,18,0.76)] p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-5">
          <Metric label="Status" value={dataFresh ? "Live" : "Stale"} helper={timeAgo(lastFetchedAt || analytics.generatedAt)} tone={dataFresh ? "positive" : "warning"} />
          <Metric label="MON" value={formatCurrency(analytics.market.priceUsd, 6)} helper={formatSignedPercent(analytics.market.change24hPct)} tone={percentTone(analytics.market.change24hPct)} />
          <Metric label="TVL" value={formatCurrency(tvl)} helper="DeFiLlama" />
          <Metric label="Validators" value={`${formatNumber(analytics.staking.activeValidators)} / ${formatNumber(analytics.staking.activeSetCap)}`} helper="gmonads" />
          <Metric label="TPS" value={formatNumber(analytics.network.tps, 2)} helper={`${formatNumber(analytics.network.transactions1h)} tx 1h`} />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="flex rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(8,16,13,0.72)] p-1">
            {CHART_RANGES.map((range) => (
              <button
                key={range.value}
                type="button"
                onClick={() => setChartRange(range.value)}
                className={`h-8 min-w-10 rounded-[var(--radius-sm)] px-2 text-[11px] font-black transition-colors ${
                  chartRange === range.value
                    ? "bg-[var(--color-accent-primary)] text-[#06110D]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => refreshAnalytics(true)}
            disabled={refreshing}
            className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(8,16,13,0.72)] px-3 text-[11px] font-bold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-accent-primary)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {refreshing ? "Syncing" : "Refresh"}
          </button>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="min-w-0 rounded-[var(--radius-lg)] border border-[rgba(132,148,142,0.26)] bg-[rgba(13,21,18,0.72)] p-4">
          <div className="mb-4 flex min-w-0 flex-col gap-3 border-b border-[rgba(132,148,142,0.2)] pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="label-caps text-[var(--color-accent-primary)]">Live chart</div>
              <h2 className="mt-2 text-[24px] font-black leading-none text-[var(--color-text-primary)]">{activeChart.label}</h2>
            </div>
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
              {chartMetrics.map((metric) => (
                <button
                  key={metric.id}
                  type="button"
                  onClick={() => setChartMetricId(metric.id)}
                  className={`shrink-0 rounded-[var(--radius-sm)] border px-3 py-2 text-[11px] font-black transition-colors ${
                    chartMetricId === metric.id
                      ? "border-[rgba(0,245,204,0.48)] bg-[rgba(0,245,204,0.13)] text-[var(--color-accent-primary)]"
                      : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>
          <LineChart metric={activeChart} />
        </div>

        <Panel title="Market Snapshot" eyebrow="Direction">
          <div className="grid gap-2">
            {chartMetrics.map((metric) => (
              <button
                key={metric.id}
                type="button"
                onClick={() => setChartMetricId(metric.id)}
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--radius-md)] border px-3 py-3 text-left transition-colors ${
                  chartMetricId === metric.id
                    ? "border-[rgba(0,245,204,0.42)] bg-[rgba(0,245,204,0.07)]"
                    : "border-[rgba(132,148,142,0.22)] bg-[rgba(8,16,13,0.32)] hover:border-[var(--color-border-hover)]"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold text-[var(--color-text-primary)]">{metric.label}</span>
                  <span className="mt-1 block truncate text-[11px] text-[var(--color-text-muted)]">{metric.helper}</span>
                </span>
                <span className="font-mono text-[14px] font-black text-[var(--color-text-primary)]">{metric.value}</span>
              </button>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="Network" eyebrow="gmonads + RPC">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Metric label="Block" value={formatNumber(analytics.network.blockHeight)} helper={`Epoch ${formatNumber(analytics.network.epoch)}`} />
            <Metric label="Gas" value={`${formatNumber(analytics.network.gasGwei, 4)} gwei`} helper={`${formatNumber(analytics.network.blockTimeSeconds, 2)}s block`} />
            <Metric label="Daily fees" value={formatCurrency(analytics.economy.dailyFeesUsd)} helper={formatCurrency(analytics.economy.annualizedFeesUsd)} />
            <Metric label="Net emission" value={formatMon(analytics.economy.netEmission24hMon)} helper="24h estimate" />
          </div>
        </Panel>

        <Panel title="DeFi" eyebrow="Depth">
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <Metric label="Chain TVL" value={formatCurrency(tvl)} />
            <Metric label="DEX TVL" value={formatCurrency(analytics.dex.tvlUsd)} />
            <Metric label="DEX 24h" value={formatCurrency(analytics.dex.volume24hUsd)} />
            <Metric label="Vol / TVL" value={formatPercent(analytics.dex.volumeToTvlPct)} />
          </div>
          <BarList items={analytics.defi.protocolTvl} formatter={formatCurrency} limit={5} />
        </Panel>

        <Panel title="Stablecoins" eyebrow="Liquidity base">
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Metric label="Total" value={formatCurrency(analytics.stablecoins.totalUsd)} />
            <Metric label="Largest" value={analytics.stablecoins.assets[0]?.symbol || "-"} helper={formatCurrency(analytics.stablecoins.assets[0]?.valueUsd)} />
          </div>
          <StablecoinTable stablecoins={analytics.stablecoins.assets} />
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Panel title="Decentralization" eyebrow="Derived from validator stake">
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <Metric label="Nakamoto 1/3" value={formatNumber(analytics.decentralization.nakamotoSafety)} helper="safety threshold" />
            <Metric label="Nakamoto 2/3" value={formatNumber(analytics.decentralization.nakamotoLiveness)} helper="liveness threshold" />
            <Metric label="Top 10 stake" value={formatPercent(analytics.decentralization.top10SharePct)} />
            <Metric label="Gini / HHI" value={`${formatNumber(analytics.decentralization.gini, 3)} / ${formatNumber(analytics.decentralization.hhi, 0)}`} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-[12px] font-black text-[var(--color-text-secondary)]">Countries</div>
              <BarList items={analytics.decentralization.countries} formatter={(value) => formatPercent(value, 1)} />
            </div>
            <div>
              <div className="mb-2 text-[12px] font-black text-[var(--color-text-secondary)]">Infrastructure</div>
              <BarList items={analytics.decentralization.providers} formatter={(value) => formatPercent(value, 1)} />
            </div>
          </div>
        </Panel>

        <Panel title="Top Validators" eyebrow="gmonads epoch set">
          <ValidatorTable validators={analytics.validators} />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="DEX Volume" eyebrow="24h leaders">
          <BarList items={analytics.dex.topProtocols} formatter={formatCurrency} limit={8} />
        </Panel>
        <Panel title="Displayed Rates" eyebrow="Yield opportunities">
          <BarList items={analytics.defi.topRates} formatter={(value) => `${value.toFixed(2)}% APR`} limit={8} />
        </Panel>
      </section>

      <div className="rounded-[var(--radius-lg)] border border-[rgba(132,148,142,0.22)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
        <span className="font-bold text-[var(--color-text-secondary)]">Sources:</span> {sourceLine || "Unavailable"}.
        <span className="ml-2">Updated {formatDateTime(analytics.generatedAt)}.</span>
      </div>
    </div>
  );
}
