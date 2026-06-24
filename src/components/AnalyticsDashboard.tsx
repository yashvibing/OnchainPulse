"use client";

import { useCallback, useEffect, useMemo, useState, useId } from "react";
import type {
  AnalyticsBar,
  AnalyticsPayload,
  AnalyticsPoint,
  AnalyticsStablecoin,
} from "@/services/analytics";

type Tone = "positive" | "negative" | "warning" | "neutral";
type ChartRange = "7d" | "30d" | "all";

const CHART_RANGES: Array<{ value: ChartRange; label: string }> = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
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

function formatSignedPercent(value?: number, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatPercent(value?: number, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toFixed(digits)}%`;
}

function formatNumber(value?: number, digits = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
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

function normalizeTimestampMs(value: number) {
  return value < 10_000_000_000 ? value * 1000 : value;
}

function formatChartDate(value?: number) {
  if (!value) return "-";
  return new Date(normalizeTimestampMs(value)).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function rangeLabel(range: ChartRange) {
  if (range === "7d") return "last 7 days";
  if (range === "30d") return "last 30 days";
  return "all available data";
}

function pointsForRange(points: AnalyticsPoint[], range: ChartRange) {
  if (range === "all" || points.length === 0) return points;
  const days = range === "7d" ? 7 : 30;
  const latest = Math.max(...points.map((point) => normalizeTimestampMs(point.timestamp)));
  const cutoff = latest - days * 86_400_000;
  return points.filter((point) => normalizeTimestampMs(point.timestamp) >= cutoff);
}

function timeAgo(value?: number) {
  if (!value) return "-";
  const minutes = Math.max(0, Math.round((Date.now() - value) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function chartPath(points: AnalyticsPoint[], width = 100, height = 44, padding = 2) {
  if (points.length < 2) return "";
  return chartCoordinates(points, width, height, padding)
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
}

function chartCoordinates(points: AnalyticsPoint[], width = 100, height = 44, padding = 2) {
  if (points.length === 0) return [];
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const denominator = Math.max(1, points.length - 1);

  return points.map((point, index) => {
      const x = padding + (index / denominator) * (width - padding * 2);
      const y = height - padding - ((point.value - min) / range) * (height - padding * 2);
      return { ...point, x, y };
    });
}

function toneClasses(tone: Tone) {
  if (tone === "positive") return "border-[rgba(0,245,204,0.42)] bg-[rgba(0,245,204,0.08)] text-[var(--color-positive)]";
  if (tone === "negative") return "border-[rgba(255,180,171,0.42)] bg-[rgba(255,180,171,0.08)] text-[var(--color-negative)]";
  if (tone === "warning") return "border-[rgba(255,214,76,0.42)] bg-[rgba(255,214,76,0.08)] text-[var(--color-warning)]";
  return "border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] text-[var(--color-text-secondary)]";
}

function percentTone(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "neutral" satisfies Tone;
  return value >= 0 ? "positive" : "negative";
}

function StatusChip({ label, value, tone = "neutral" }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className={`min-w-0 rounded-[var(--radius-md)] border px-3 py-2 ${toneClasses(tone)}`}>
      <div className="label-caps text-current opacity-70">{label}</div>
      <div className="mt-1 truncate font-mono text-[13px] font-bold">{value}</div>
    </div>
  );
}

function SectionPanel({
  id,
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(13,21,18,0.88)] p-4 md:p-5 ${className}`}
    >
      <div className="mb-5 flex min-w-0 flex-col gap-3 border-b border-[rgba(132,148,142,0.24)] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="label-caps text-[var(--color-accent-primary)]">{eyebrow}</div>}
          <h2 className="mt-2 text-[20px] font-black leading-tight text-[var(--color-text-primary)]">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricTile({
  label,
  value,
  helper,
  tone = "neutral",
  size = "normal",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: Tone;
  size?: "normal" | "large";
}) {
  const valueColor =
    tone === "positive"
      ? "text-[var(--color-positive)]"
      : tone === "negative"
        ? "text-[var(--color-negative)]"
        : tone === "warning"
          ? "text-[var(--color-warning)]"
          : "text-[var(--color-text-primary)]";

  return (
    <div className="min-w-0 border-l border-[rgba(132,148,142,0.28)] pl-4">
      <div className="label-caps text-[var(--color-text-dim)]">{label}</div>
      <div
        className={`mt-2 break-words font-black leading-none ${valueColor} ${
          size === "large" ? "text-[clamp(30px,4vw,56px)]" : "text-[clamp(22px,2vw,30px)]"
        }`}
      >
        {value}
      </div>
      {helper && <div className="mt-2 text-[12px] leading-relaxed text-[var(--color-text-muted)]">{helper}</div>}
    </div>
  );
}

function MiniMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="min-w-0 rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.24)] bg-[rgba(8,16,13,0.46)] px-3 py-3">
      <div className="label-caps text-[var(--color-text-dim)]">{label}</div>
      <div className="mt-2 truncate font-mono text-[15px] font-bold text-[var(--color-text-primary)]">{value}</div>
      {helper && <div className="mt-1 truncate text-[11px] text-[var(--color-text-muted)]">{helper}</div>}
    </div>
  );
}

function InsightCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: Tone;
}) {
  return (
    <div className={`rounded-[var(--radius-md)] border px-4 py-3 ${toneClasses(tone)}`}>
      <div className="label-caps text-current opacity-70">{label}</div>
      <div className="mt-2 text-[18px] font-black leading-tight">{value}</div>
      <div className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">{detail}</div>
    </div>
  );
}

function TrendChart({
  points,
  color = "var(--color-accent-primary)",
  heightClass = "h-[260px]",
  valueFormatter = formatCurrency,
  label = "Trend",
}: {
  points: AnalyticsPoint[];
  color?: string;
  heightClass?: string;
  valueFormatter?: (value: number) => string;
  label?: string;
}) {
  const gradientId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const line = chartPath(points);
  const area = line ? `${line} L98,44 L2,44 Z` : "";
  const coordinates = useMemo(() => chartCoordinates(points), [points]);
  const activePoint = activeIndex !== null ? coordinates[activeIndex] : coordinates[coordinates.length - 1];

  if (!line) {
    return (
      <div className={`flex ${heightClass} items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[13px] text-[var(--color-text-muted)]`}>
        Chart unavailable.
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 100 44"
      className={`${heightClass} w-full rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.24)] bg-[rgba(8,16,13,0.42)]`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label} chart`}
      onPointerMove={(event) => {
        if (coordinates.length === 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        setActiveIndex(Math.round(ratio * (coordinates.length - 1)));
      }}
      onPointerLeave={() => setActiveIndex(null)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0,11 H100 M0,22 H100 M0,33 H100" stroke="rgba(255,255,255,0.07)" strokeWidth="0.3" />
      <path d={area} fill={`url(#${gradientId})`} className="transition-all duration-500 ease-out" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.05"
        vectorEffect="non-scaling-stroke"
        className="[stroke-dasharray:180] [stroke-dashoffset:0] transition-all duration-700 ease-out"
      />
      {activePoint && (
        <g>
          <line
            x1={activePoint.x}
            x2={activePoint.x}
            y1="2"
            y2="42"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="0.45"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={activePoint.x}
            cy={activePoint.y}
            r="1.35"
            fill="var(--color-bg-surface-solid)"
            stroke={color}
            strokeWidth="0.75"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
      {activePoint && (
        <foreignObject x="4" y="3" width="42" height="14">
          <div className="rounded border border-[rgba(255,255,255,0.16)] bg-[rgba(8,16,13,0.86)] px-1.5 py-1 text-[3px] font-bold leading-none text-[var(--color-text-primary)]">
            <div>{valueFormatter(activePoint.value)}</div>
            <div className="mt-0.5 text-[2.4px] font-semibold text-[var(--color-text-muted)]">{formatChartDate(activePoint.timestamp)}</div>
          </div>
        </foreignObject>
      )}
    </svg>
  );
}

function VolumeBars({ points, heightClass = "h-[132px]" }: { points: AnalyticsPoint[]; heightClass?: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const max = Math.max(...points.map((point) => point.value), 1);
  const activePoint = activeIndex !== null ? points[activeIndex] : points[points.length - 1];
  if (points.length === 0) {
    return (
      <div className={`flex ${heightClass} items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[13px] text-[var(--color-text-muted)]`}>
        No volume data.
      </div>
    );
  }

  return (
    <div
      className={`relative flex ${heightClass} items-end gap-1 rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.24)] bg-[rgba(8,16,13,0.42)] px-2 pb-2 pt-8`}
      onPointerLeave={() => setActiveIndex(null)}
    >
      {activePoint && (
        <div className="absolute left-3 top-2 z-[1] rounded border border-[rgba(255,255,255,0.12)] bg-[rgba(8,16,13,0.82)] px-2 py-1 text-[10px] font-bold text-[var(--color-text-primary)]">
          {formatCurrency(activePoint.value)}
          <span className="ml-2 font-semibold text-[var(--color-text-muted)]">{formatChartDate(activePoint.timestamp)}</span>
        </div>
      )}
      {points.map((point, index) => {
        const isActive = index === activeIndex || (activeIndex === null && index === points.length - 1);
        return (
          <button
            key={`${point.timestamp}-${point.value}`}
            type="button"
            aria-label={`${formatCurrency(point.value)} on ${formatChartDate(point.timestamp)}`}
            onPointerEnter={() => setActiveIndex(index)}
            onFocus={() => setActiveIndex(index)}
            onBlur={() => setActiveIndex(null)}
            className={`min-w-0 flex-1 rounded-t-sm transition-all duration-300 ease-out ${
              isActive
                ? "bg-[linear-gradient(180deg,var(--color-accent-primary),rgba(0,245,204,0.34))] opacity-100"
                : "bg-[linear-gradient(180deg,var(--color-accent-secondary),rgba(220,184,255,0.28))] opacity-75 hover:opacity-95"
            }`}
            style={{ height: `${Math.max(5, (point.value / max) * 100)}%` }}
            title={formatCurrency(point.value)}
          />
        );
      })}
    </div>
  );
}

function BarList({
  items,
  valueFormatter,
  maxValue,
  limit,
}: {
  items: AnalyticsBar[];
  valueFormatter: (value: number) => string;
  maxValue?: number;
  limit?: number;
}) {
  const [activeLabel, setActiveLabel] = useState("");
  const visible = typeof limit === "number" ? items.slice(0, limit) : items;
  const max = maxValue || Math.max(...visible.map((item) => item.value), 1);

  if (visible.length === 0) {
    return <div className="text-[13px] text-[var(--color-text-muted)]">No data available.</div>;
  }

  return (
    <div className="space-y-3">
      {visible.map((item) => {
        const isActive = activeLabel === item.label;
        return (
        <div
          key={item.label}
          className={`grid min-w-0 gap-2 rounded-[var(--radius-sm)] px-2 py-1 transition-colors sm:grid-cols-[minmax(0,1fr)_128px_auto] sm:items-center ${
            isActive ? "bg-[rgba(0,245,204,0.06)]" : "hover:bg-[rgba(255,255,255,0.025)]"
          }`}
          onPointerEnter={() => setActiveLabel(item.label)}
          onPointerLeave={() => setActiveLabel("")}
        >
          <div className="min-w-0">
            <div className="truncate text-[14px] font-bold text-[var(--color-text-primary)]">{item.label}</div>
            {item.detail && <div className="truncate text-[11px] text-[var(--color-text-muted)]">{item.detail}</div>}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                isActive
                  ? "bg-[linear-gradient(90deg,var(--color-accent-primary),var(--color-accent-secondary))]"
                  : "bg-[linear-gradient(90deg,var(--color-accent-primary),var(--color-accent-violet))]"
              }`}
              style={{ width: `${Math.max(3, Math.min(100, (item.value / max) * 100))}%` }}
            />
          </div>
          <div className="min-w-0 text-left font-mono text-[13px] text-[var(--color-text-secondary)] sm:text-right">
            {valueFormatter(item.value)}
          </div>
        </div>
      );
      })}
    </div>
  );
}

function StablecoinTable({ stablecoins }: { stablecoins: AnalyticsStablecoin[] }) {
  if (stablecoins.length === 0) {
    return <div className="text-[13px] text-[var(--color-text-muted)]">No stablecoin data available.</div>;
  }

  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[var(--color-text-dim)]">
            <th className="py-2 pr-3 font-semibold">Asset</th>
            <th className="py-2 pr-3 text-right font-semibold">Amount</th>
            <th className="py-2 pr-3 text-right font-semibold">Share</th>
            <th className="py-2 pr-3 text-right font-semibold">30d</th>
          </tr>
        </thead>
        <tbody>
          {stablecoins.map((asset) => (
            <tr key={asset.symbol} className="border-b border-[rgba(255,255,255,0.055)]">
              <td className="py-3 pr-3 font-bold text-[var(--color-text-primary)]">{asset.symbol}</td>
              <td className="py-3 pr-3 text-right font-mono text-[var(--color-text-secondary)]">
                {formatCurrency(asset.valueUsd)}
              </td>
              <td className="py-3 pr-3 text-right font-mono text-[var(--color-text-secondary)]">
                {formatPercent(asset.sharePct, 1)}
              </td>
              <td className="py-3 pr-3 text-right font-mono text-[var(--color-text-secondary)]">
                {formatSignedPercent(asset.change30dPct, 1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function loadAnalytics() {
  const response = await fetch("/api/analytics");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load analytics.");
  return data.data as AnalyticsPayload;
}

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [chartRange, setChartRange] = useState<ChartRange>("30d");
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

  const sourceLine = useMemo(() => analytics?.sources.join(" + ") || "", [analytics]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-16 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
        <div className="h-[440px] animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
          <div className="h-72 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[rgba(255,184,0,0.45)] bg-[rgba(255,184,0,0.08)] px-5 py-6 text-[14px] text-[var(--color-warning)]">
        {error || "Could not load analytics."}
      </div>
    );
  }

  const priceTone = percentTone(analytics.market.change24hPct);
  const monthTone = percentTone(analytics.market.change30dPct);
  const tvl = analytics.defi.totalChainTvlUsd ?? analytics.defi.totalTvlUsd;
  const volumeToTvl = analytics.dex.volumeToTvlPct;
  const dataAgeMinutes = Math.round((Date.now() - analytics.generatedAt) / 60000);
  const dataFresh = dataAgeMinutes <= 15;
  const sourceCount = analytics.sources.length;
  const pricePoints = pointsForRange(analytics.market.priceTrend, chartRange);
  const feePoints = pointsForRange(analytics.economy.feeTrend, chartRange);
  const dexVolumePoints = pointsForRange(analytics.dex.volumeTrend, chartRange);
  const defiVolumePoints = pointsForRange(analytics.defi.volume30dTrend, chartRange);
  const navItems = [
    ["Overview", "#overview"],
    ["Market", "#market"],
    ["Network", "#network"],
    ["DeFi", "#defi"],
  ];

  return (
    <div className="min-w-0 space-y-5">
      <div className="sticky top-0 z-10 -mx-1 border-b border-[rgba(132,148,142,0.22)] bg-[rgba(8,16,13,0.88)] px-1 py-3 backdrop-blur">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 gap-2 overflow-x-auto">
            {navItems.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(13,21,18,0.8)] px-3 py-2 text-[12px] font-bold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-accent-primary)]"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="flex rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(13,21,18,0.8)] p-1">
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
              className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(13,21,18,0.8)] px-3 text-[11px] font-bold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-accent-primary)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {refreshing ? "Syncing..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <section id="overview" className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatusChip label="Status" value={dataFresh ? "Live" : "Stale"} tone={dataFresh ? "positive" : "warning"} />
        <StatusChip label="Updated" value={timeAgo(lastFetchedAt || analytics.generatedAt)} />
        <StatusChip label="RPC block" value={formatNumber(analytics.network.blockHeight)} tone="positive" />
        <StatusChip label="Sources" value={`${sourceCount} connected`} />
        <StatusChip label="Epoch" value={formatNumber(analytics.network.epoch)} tone={analytics.network.inEpochDelayPeriod ? "warning" : "neutral"} />
      </section>

      <section
        id="market"
        className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[linear-gradient(135deg,rgba(0,245,204,0.11),rgba(220,184,255,0.08)_34%,rgba(13,21,18,0.96)_70%)] p-4 md:p-6"
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
          <div className="min-w-0">
            <div className="label-caps text-[var(--color-accent-primary)]">Market command center</div>
            <h2 className="mt-3 max-w-[520px] text-[clamp(30px,5vw,58px)] font-black leading-[0.95] text-[var(--color-text-primary)]">
              Monad market pulse
            </h2>
            <p className="mt-4 max-w-[560px] text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
              Price, liquidity, open interest, and DEX flow in one place. The goal is to show direction first, then the supporting numbers.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <MetricTile label="MON price" value={formatCurrency(analytics.market.priceUsd, 6)} helper="Native asset price" tone={priceTone} size="large" />
              <MetricTile label="24h move" value={formatSignedPercent(analytics.market.change24hPct)} helper="Short-term momentum" tone={priceTone} size="large" />
              <MetricTile label="30d move" value={formatSignedPercent(analytics.market.change30dPct)} helper="Monthly direction" tone={monthTone} />
              <MetricTile label="Market cap" value={formatCurrency(analytics.market.marketCapUsd)} helper={`FDV ${formatCurrency(analytics.market.fdvUsd)}`} />
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <MiniMetric label="24h volume" value={formatCurrency(analytics.market.volume24hUsd ?? analytics.dex.volume24hUsd)} />
              <MiniMetric label="Open interest" value={formatCurrency(analytics.market.openInterestUsd)} />
              <MiniMetric label="Chain TVL" value={formatCurrency(tvl)} />
            </div>
            <TrendChart
              points={pricePoints}
              color="var(--color-accent-secondary)"
              heightClass="h-[300px]"
              valueFormatter={(value) => formatCurrency(value, 6)}
              label={`MON price, ${rangeLabel(chartRange)}`}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <InsightCard
          label="Liquidity efficiency"
          value={formatPercent(volumeToTvl, 2)}
          detail="24h DEX volume as a share of DEX TVL."
          tone={typeof volumeToTvl === "number" && volumeToTvl >= 10 ? "positive" : "neutral"}
        />
        <InsightCard
          label="Market momentum"
          value={formatSignedPercent(analytics.market.change30dPct)}
          detail="MON price movement over the last 30 days."
          tone={monthTone}
        />
        <InsightCard
          label="Fee run rate"
          value={formatCurrency(analytics.economy.annualizedFeesUsd)}
          detail="Annualized chain fees from recent fee data."
          tone="neutral"
        />
      </section>

      <SectionPanel id="network" eyebrow="Network health" title="Execution, fees, and emission">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MiniMetric label="Gas" value={`${formatNumber(analytics.network.gasGwei, 4)} gwei`} />
          <MiniMetric label="Block time" value={analytics.network.blockTimeSeconds ? `${analytics.network.blockTimeSeconds}s` : "-"} />
          <MiniMetric label="Finality" value={analytics.network.finalitySeconds ? `${analytics.network.finalitySeconds}s` : "-"} />
          <MiniMetric label="Daily fees" value={formatCurrency(analytics.economy.dailyFeesUsd)} />
          <MiniMetric label="Annual fees" value={formatCurrency(analytics.economy.annualizedFeesUsd)} />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
          <VolumeBars points={feePoints} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <MiniMetric label="Burn est. 24h" value={formatMon(analytics.economy.burnRate24hMon)} helper="recent blocks" />
            <MiniMetric label="Net emission 24h" value={formatMon(analytics.economy.netEmission24hMon)} />
            <MiniMetric label="Inflation rate" value={formatPercent(analytics.economy.inflationRatePct, 2)} />
          </div>
        </div>
      </SectionPanel>

      <div id="defi" className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SectionPanel eyebrow="DeFi and liquidity" title="Where capital is sitting">
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <MiniMetric label="Chain TVL" value={formatCurrency(analytics.defi.totalChainTvlUsd)} />
            <MiniMetric label="Tracked TVL" value={formatCurrency(analytics.defi.totalTvlUsd)} />
            <MiniMetric label="DEX TVL" value={formatCurrency(analytics.dex.tvlUsd)} />
          </div>
          <BarList items={analytics.defi.protocolTvl} valueFormatter={formatCurrency} limit={8} />
          <div className="mt-5">
            <TrendChart
              points={defiVolumePoints}
              color="var(--color-accent-primary)"
              heightClass="h-[180px]"
              label={`DeFi volume, ${rangeLabel(chartRange)}`}
            />
          </div>
        </SectionPanel>

        <SectionPanel eyebrow="DEX flow" title="Volume, fees, and efficiency">
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniMetric label="24h volume" value={formatCurrency(analytics.dex.volume24hUsd)} />
            <MiniMetric label="7d volume" value={formatCurrency(analytics.dex.volume7dUsd)} />
            <MiniMetric label="24h fees" value={formatCurrency(analytics.dex.fees24hUsd)} />
            <MiniMetric label="Volume / TVL" value={formatPercent(analytics.dex.volumeToTvlPct, 2)} />
          </div>
          <div className="mt-5">
            <VolumeBars points={dexVolumePoints} />
          </div>
        </SectionPanel>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <SectionPanel title="Top DEX volume" eyebrow="24h protocol flow">
          <BarList items={analytics.dex.topProtocols} valueFormatter={formatCurrency} limit={6} />
        </SectionPanel>

        <SectionPanel title="Liquidity venues" eyebrow="DEX liquidity">
          <BarList items={analytics.defi.topDexLiquidity} valueFormatter={formatCurrency} limit={6} />
        </SectionPanel>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <SectionPanel title="Top displayed rates" eyebrow="DeFi opportunities">
          <BarList
            items={analytics.defi.topRates}
            valueFormatter={(value) => `${value.toFixed(2)}% APR`}
            limit={8}
          />
        </SectionPanel>

        <SectionPanel title="Stablecoin base" eyebrow="Liquidity quality">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <MiniMetric label="Total stablecoins" value={formatCurrency(analytics.stablecoins.totalUsd)} />
            <MiniMetric label="Largest asset" value={analytics.stablecoins.assets[0]?.symbol || "-"} helper={formatCurrency(analytics.stablecoins.assets[0]?.valueUsd)} />
          </div>
          <StablecoinTable stablecoins={analytics.stablecoins.assets} />
        </SectionPanel>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-4 py-3 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
        <span className="font-bold text-[var(--color-text-secondary)]">Data sources:</span> {sourceLine || "Unavailable"}.
        <span className="ml-2">Refreshed {formatDateTime(analytics.generatedAt)}.</span>
      </div>
    </div>
  );
}
