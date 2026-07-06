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
type MetricCategory = "core" | "volume" | "fees" | "flows" | "network" | "valuation";
type ChartMetricId =
  | "price"
  | "marketCap"
  | "fdv"
  | "marketVolume"
  | "chainFees"
  | "chainRevenue"
  | "chainRev"
  | "tokenIncentives"
  | "appRevenue"
  | "appFees"
  | "feesPaid"
  | "dexVolume"
  | "dexVolumeAverage"
  | "perpsVolume"
  | "activeAddresses"
  | "netInflows"
  | "totalRaised"
  | "bridgedTvl"
  | "rwaActiveMcap"
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
  category: MetricCategory;
  points: AnalyticsPoint[];
  formatter: (value: number) => string;
  mark: "area" | "line" | "bar";
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

const CATEGORY_ORDER: MetricCategory[] = ["core", "volume", "fees", "flows", "network", "valuation"];

const CATEGORY_LABELS: Record<MetricCategory, string> = {
  core: "Core",
  volume: "Volume",
  fees: "Fees & revenue",
  flows: "Flows & liquidity",
  network: "Network & staking",
  valuation: "Valuation",
};

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

function isChartable(metric: ChartMetric) {
  return metric.points.length >= 2;
}

function buildChartMetrics(analytics: AnalyticsPayload, range: ChartRange): ChartMetric[] {
  const pricePoints = pointsForRange(analytics.market.priceTrend, range);
  const dexPoints = pointsForRange(analytics.dex.volumeTrend, range);
  const feePoints = pointsForRange(analytics.economy.feeTrend, range);
  const tvlPoints = pointsForRange(analytics.defi.tvlTrend, range);
  const stablePoints = pointsForRange(analytics.stablecoins.trend, range);
  const revenuePoints = pointsForRange(analytics.economy.chainRevenueTrend, range);
  const appRevenuePoints = pointsForRange(analytics.economy.appRevenueTrend, range);
  const appFeesPoints = pointsForRange(analytics.economy.appFeesTrend, range);
  const userFeesPoints = pointsForRange(analytics.economy.userFeesTrend, range);
  const perpsPoints = pointsForRange(analytics.derivatives.perpsVolumeTrend, range);
  const inflowPoints = pointsForRange(analytics.flows.netInflowsTrend, range);
  const dexAveragePoints = movingAverageTrend(dexPoints);
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
  const tvl = analytics.defi.totalChainTvlUsd ?? analytics.defi.totalTvlUsd;

  return [
    {
      id: "price",
      label: "MON price",
      value: formatCurrency(analytics.market.priceUsd, 6),
      helper: formatSignedPercent(changeForPoints(pricePoints)),
      color: "#2f81ff",
      category: "core",
      points: pricePoints,
      formatter: (value) => formatCurrency(value, 6),
      mark: "line",
      tone: toneForPercent(changeForPoints(pricePoints)),
    },
    {
      id: "marketCap",
      label: "Market cap",
      value: formatCurrency(analytics.market.marketCapUsd),
      helper: "derived from MON price",
      color: "#ff2f7d",
      category: "core",
      points: marketCapPoints,
      formatter: formatCurrency,
      mark: "area",
    },
    {
      id: "fdv",
      label: "FDV",
      value: formatCurrency(analytics.market.fdvUsd),
      helper: "fully diluted value",
      color: "#d22cff",
      category: "core",
      points: fdvPoints,
      formatter: formatCurrency,
      mark: "line",
    },
    {
      id: "chainTvl",
      label: "TVL",
      value: formatCurrency(tvl),
      helper: `${analytics.defi.protocolTvl.length} tracked protocols`,
      color: "#2f81ff",
      category: "core",
      points: tvlPoints,
      formatter: formatCurrency,
      mark: "area",
    },
    {
      id: "stableLiquidity",
      label: "Stablecoins mcap",
      value: formatCurrency(analytics.stablecoins.totalUsd),
      helper: topStable ? `${topStable.symbol} ${formatPercent(topStable.sharePct)}` : "tracked stables",
      color: "#ff2f7d",
      category: "core",
      points: stablePoints,
      formatter: formatCurrency,
      mark: "area",
    },
    {
      id: "marketVolume",
      label: "Market volume",
      value: formatCurrency(analytics.market.volume24hUsd),
      helper: "24h token volume",
      color: "#8b5cf6",
      category: "volume",
      points: [],
      formatter: formatCurrency,
      mark: "bar",
    },
    {
      id: "dexVolume",
      label: "DEX volume",
      value: formatCurrency(analytics.dex.volume24hUsd),
      helper: "24h volume",
      color: "#50c861",
      category: "volume",
      points: dexPoints,
      formatter: formatCurrency,
      mark: "bar",
    },
    {
      id: "dexVolumeAverage",
      label: "DEX 7d avg",
      value: formatCurrency(latestValue(dexAveragePoints)),
      helper: "smoothed volume",
      color: "#9bd66b",
      category: "volume",
      points: dexAveragePoints,
      formatter: formatCurrency,
      mark: "line",
    },
    {
      id: "perpsVolume",
      label: "Perps volume",
      value: formatCurrency(analytics.derivatives.perpsVolume24hUsd),
      helper: analytics.derivatives.perpsVolume7dUsd ? `${formatCurrency(analytics.derivatives.perpsVolume7dUsd)} 7d` : "DefiLlama snapshot",
      color: "#a855f7",
      category: "volume",
      points: perpsPoints,
      formatter: formatCurrency,
      mark: "bar",
      tone: toneForPercent(analytics.derivatives.perpsChange7dPct),
    },
    {
      id: "volumeToTvl",
      label: "Volume / TVL",
      value: formatPercent(analytics.dex.volumeToTvlPct),
      helper: "DEX capital velocity",
      color: "#f97316",
      category: "volume",
      points: [],
      formatter: (value) => formatPercent(value),
      mark: "bar",
    },
    {
      id: "feesPaid",
      label: "Fees paid",
      value: formatCurrency(analytics.economy.dailyFeesUsd),
      helper: "24h protocol fees",
      color: "#fb923c",
      category: "fees",
      points: userFeesPoints.length > 0 ? userFeesPoints : feePoints,
      formatter: formatCurrency,
      mark: "bar",
    },
    {
      id: "chainFees",
      label: "Chain fees",
      value: formatCurrency(analytics.economy.chainFeesUsd),
      helper: "24h chain-native fees",
      color: "#50c861",
      category: "fees",
      points: [],
      formatter: formatCurrency,
      mark: "bar",
    },
    {
      id: "chainRevenue",
      label: "Chain revenue",
      value: formatCurrency(analytics.economy.chainRevenueUsd),
      helper: "24h chain revenue",
      color: "#14b8a6",
      category: "fees",
      points: revenuePoints,
      formatter: formatCurrency,
      mark: "bar",
    },
    {
      id: "chainRev",
      label: "REV (fees + tips)",
      value: formatCurrency(analytics.economy.chainRevUsd),
      helper: "24h real economic value",
      color: "#22c55e",
      category: "fees",
      points: [],
      formatter: formatCurrency,
      mark: "bar",
    },
    {
      id: "tokenIncentives",
      label: "Token incentives",
      value: formatCurrency(analytics.economy.tokenIncentivesUsd),
      helper: "24h emissions",
      color: "#facc15",
      category: "fees",
      points: [],
      formatter: formatCurrency,
      mark: "bar",
    },
    {
      id: "appRevenue",
      label: "App revenue",
      value: formatCurrency(analytics.economy.appRevenueUsd),
      helper: "24h app revenue",
      color: "#06b6d4",
      category: "fees",
      points: appRevenuePoints,
      formatter: formatCurrency,
      mark: "bar",
    },
    {
      id: "appFees",
      label: "App fees",
      value: formatCurrency(analytics.economy.appFeesUsd),
      helper: "24h app fees",
      color: "#c75323",
      category: "fees",
      points: appFeesPoints,
      formatter: formatCurrency,
      mark: "bar",
    },
    {
      id: "annualizedFees",
      label: "Annualized fees",
      value: formatCurrency(analytics.economy.annualizedFeesUsd),
      helper: "daily fees x 365",
      color: "#f59e0b",
      category: "fees",
      points: annualizedFeePoints,
      formatter: formatCurrency,
      mark: "line",
    },
    {
      id: "netInflows",
      label: "Net inflows",
      value: formatCurrency(analytics.flows.netInflows24hUsd),
      helper: "24h bridge flow",
      color: "#7c3aed",
      category: "flows",
      points: inflowPoints,
      formatter: formatCurrency,
      mark: "bar",
      tone:
        typeof analytics.flows.netInflows24hUsd === "number"
          ? analytics.flows.netInflows24hUsd >= 0
            ? "positive"
            : "negative"
          : "neutral",
    },
    {
      id: "bridgedTvl",
      label: "Bridged TVL",
      value: formatCurrency(analytics.defi.bridgedTvlUsd),
      helper: "DefiLlama chain assets",
      color: "#38bdf8",
      category: "flows",
      points: [],
      formatter: formatCurrency,
      mark: "area",
    },
    {
      id: "dexTvl",
      label: "DEX TVL",
      value: formatCurrency(analytics.dex.tvlUsd),
      helper: "tracked DEX liquidity",
      color: "#06b6d4",
      category: "flows",
      points: [],
      formatter: formatCurrency,
      mark: "area",
    },
    {
      id: "rwaActiveMcap",
      label: "RWA active mcap",
      value: formatCurrency(analytics.defi.rwaActiveMcapUsd),
      helper: "DefiLlama snapshot",
      color: "#f59e0b",
      category: "flows",
      points: [],
      formatter: formatCurrency,
      mark: "area",
    },
    {
      id: "totalRaised",
      label: "Total raised",
      value: formatCurrency(analytics.defi.totalRaisedUsd),
      helper: "funding rounds",
      color: "#f97316",
      category: "flows",
      points: [],
      formatter: formatCurrency,
      mark: "bar",
    },
    {
      id: "activeAddresses",
      label: "Active addresses",
      value: formatNumber(analytics.network.activeAddresses),
      helper: "24h active wallets",
      color: "#d22cff",
      category: "network",
      points: [],
      formatter: formatNumber,
      mark: "bar",
    },
    {
      id: "stakedValue",
      label: "Staked value",
      value: formatCurrency(analytics.staking.totalValueStakedUsd),
      helper: formatMon(analytics.staking.totalActiveStakeMon),
      color: "#a78bfa",
      category: "network",
      points: [],
      formatter: formatCurrency,
      mark: "area",
    },
    {
      id: "stakingApy",
      label: "Staking APY",
      value: formatPercent(analytics.staking.estimatedApyPct),
      helper: `${formatPercent(analytics.staking.minApyPct)} - ${formatPercent(analytics.staking.maxApyPct)}`,
      color: "#84cc16",
      category: "network",
      points: [],
      formatter: (value) => formatPercent(value),
      mark: "line",
      tone: analytics.staking.estimatedApyPct && analytics.staking.estimatedApyPct > 8 ? "positive" : "neutral",
    },
    {
      id: "activeValidators",
      label: "Validators",
      value: formatNumber(analytics.staking.activeValidators),
      helper: `${formatNumber(analytics.staking.activeSetCap)} active cap`,
      color: "#22c55e",
      category: "network",
      points: [],
      formatter: formatNumber,
      mark: "bar",
    },
    {
      id: "nakamotoSafety",
      label: "Nakamoto safety",
      value: formatNumber(analytics.decentralization.nakamotoSafety),
      helper: "validators for 1/3 stake",
      color: "#38bdf8",
      category: "network",
      points: [],
      formatter: formatNumber,
      mark: "bar",
    },
    {
      id: "top10Stake",
      label: "Top 10 stake",
      value: formatPercent(analytics.decentralization.top10SharePct),
      helper: "validator concentration",
      color: "#fb7185",
      category: "network",
      points: [],
      formatter: (value) => formatPercent(value),
      mark: "bar",
      tone: analytics.decentralization.top10SharePct && analytics.decentralization.top10SharePct > 45 ? "warning" : "neutral",
    },
    {
      id: "psRatio",
      label: "P/S",
      value: formatNumber(analytics.economy.psRatio, 1),
      helper: "market cap / annual fees",
      color: "#facc15",
      category: "valuation",
      points: [],
      formatter: (value) => formatNumber(value, 1),
      mark: "line",
    },
    {
      id: "pfRatio",
      label: "P/F",
      value: formatNumber(analytics.economy.pfRatio, 1),
      helper: "market cap / fee run-rate",
      color: "#fb923c",
      category: "valuation",
      points: [],
      formatter: (value) => formatNumber(value, 1),
      mark: "line",
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

function StatRow({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: Tone;
}) {
  const valueColor =
    tone === "positive"
      ? "text-[var(--color-positive)]"
      : tone === "negative"
        ? "text-[var(--color-negative)]"
        : "text-[var(--color-text-primary)]";

  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-[rgba(132,148,142,0.14)] py-2.5 first:border-t-0">
      <div className="min-w-0">
        <div className="truncate text-[12px] font-bold text-[var(--color-text-muted)]">{label}</div>
        {helper && <div className="mt-0.5 truncate text-[10px] font-semibold text-[var(--color-text-dim)]">{helper}</div>}
      </div>
      <div className={`shrink-0 font-mono text-[14px] font-black ${valueColor}`}>{value}</div>
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

function SelectedMetricPill({
  metric,
  onRemove,
}: {
  metric: ChartMetric;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${metric.label} from chart`}
      className="flex h-9 max-w-full items-center gap-2 rounded-full border bg-[rgba(255,255,255,0.025)] px-3 text-[12px] font-black text-[var(--color-text-primary)] transition-colors hover:bg-[rgba(255,255,255,0.05)]"
      style={{ borderColor: metric.color, boxShadow: `inset 0 0 0 1px ${metric.color}` }}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: metric.color }} />
      <span className="truncate">{metric.label}</span>
      <span className="font-mono text-[14px] leading-none opacity-70" aria-hidden="true">
        ×
      </span>
    </button>
  );
}

function MetricPickerModal({
  metrics,
  selectedIds,
  onToggle,
  onClose,
}: {
  metrics: ChartMetric[];
  selectedIds: ChartMetricId[];
  onToggle: (metric: ChartMetric) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? metrics.filter((metric) => metric.label.toLowerCase().includes(normalizedQuery))
    : metrics;
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    all: metrics.filter((metric) => metric.category === category),
    visible: filtered.filter((metric) => metric.category === category),
  })).filter((group) => group.all.length > 0);
  const selectedCount = metrics.filter((metric) => selectedIds.includes(metric.id)).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chart metrics"
      className="absolute left-0 top-[calc(100%+8px)] z-40 w-[min(560px,calc(100vw-48px))] rounded-[var(--radius-lg)] border border-[rgba(132,148,142,0.35)] bg-[var(--color-bg-surface-solid)] shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[rgba(132,148,142,0.18)] px-4 py-3">
        <div className="flex items-baseline gap-2">
          <div className="text-[15px] font-black text-[var(--color-text-primary)]">Chart metrics</div>
          <div className="font-mono text-[11px] font-bold text-[var(--color-text-dim)]">
            {selectedCount}/{metrics.length}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close metric picker"
          className="grid h-8 w-8 place-items-center rounded-[var(--radius-md)] border border-transparent text-[16px] font-black text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border)] hover:text-[var(--color-text-primary)]"
        >
          ×
        </button>
      </div>

      <div className="max-h-[min(420px,60vh)] overflow-y-auto px-4 pb-4">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${metrics.length} metrics...`}
          className="mt-3 h-10 w-full rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.28)] bg-[rgba(255,255,255,0.03)] px-3 text-[13px] font-semibold text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-border-hover)] focus:outline-none"
        />

        {groups.map((group) => {
          if (normalizedQuery && group.visible.length === 0) return null;
          const groupSelected = group.all.filter((metric) => selectedIds.includes(metric.id)).length;
          return (
            <div key={group.category} className="mt-4">
              <div className="label-caps flex items-baseline gap-2 text-[var(--color-text-dim)]">
                <span>{CATEGORY_LABELS[group.category]}</span>
                <span className="font-mono">
                  {groupSelected}/{group.all.length}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.visible.map((metric) => {
                  const selected = selectedIds.includes(metric.id);
                  return (
                    <button
                      key={metric.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onToggle(metric)}
                      className={`flex h-9 max-w-full items-center gap-2 rounded-full border px-3 text-[12px] font-black transition-colors ${
                        selected
                          ? "bg-[rgba(255,255,255,0.04)] text-[var(--color-text-primary)]"
                          : "border-[rgba(132,148,142,0.24)] bg-[rgba(255,255,255,0.018)] text-[var(--color-text-secondary)] hover:bg-[rgba(255,255,255,0.045)]"
                      }`}
                      style={selected ? { borderColor: metric.color } : undefined}
                    >
                      {selected ? (
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: metric.color }} />
                      ) : (
                        <span className="font-mono text-[14px] leading-none text-[var(--color-text-dim)]" aria-hidden="true">
                          +
                        </span>
                      )}
                      <span className="truncate">{metric.label}</span>
                      {selected && (
                        <span className="font-mono text-[14px] leading-none opacity-70" aria-hidden="true">
                          ×
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {normalizedQuery && filtered.length === 0 && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.2)] px-3 py-4 text-center text-[12px] font-semibold text-[var(--color-text-muted)]">
            No chartable metric matches &ldquo;{query}&rdquo;.
          </div>
        )}
      </div>
    </div>
  );
}

function MultiMetricChart({ metrics }: { metrics: ChartMetric[] }) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const chartableMetrics = metrics.filter(isChartable);
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
          const areaPath = metric.mark === "area" && path ? `${path} L98,54 L2,54 Z` : "";
          const barWidth = Math.max(0.18, Math.min(0.95, 58 / Math.max(coordinates.length, 1)));
          return (
            <g key={metric.id}>
              {metric.mark === "bar" ? (
                coordinates.map((coordinate, coordinateIndex) => (
                  <rect
                    key={`${metric.id}-${coordinateIndex}`}
                    x={coordinate.x - barWidth / 2}
                    y={coordinate.y}
                    width={barWidth}
                    height={54 - coordinate.y}
                    rx="0.08"
                    fill={metric.color}
                    opacity={coordinateIndex === activeIndex ? 0.82 : index === 0 ? 0.42 : 0.28}
                    vectorEffect="non-scaling-stroke"
                  />
                ))
              ) : (
                <>
                  {areaPath && <path d={areaPath} fill={index === 0 ? "url(#comparison-area)" : metric.color} opacity={index === 0 ? 1 : 0.08} />}
                  <path
                    d={path}
                    fill="none"
                    stroke={metric.color}
                    strokeWidth={index === 0 ? "2.3" : "2"}
                    opacity={index === 0 ? 1 : 0.86}
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              )}
              {activePoint && metric.mark !== "bar" && (
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
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="h-[420px] animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
        <div className="h-[420px] animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
      </div>
      <div className="h-48 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
    </div>
  );
}

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [meta, setMeta] = useState<AnalyticsMeta | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>("30d");
  const [selectedMetricIds, setSelectedMetricIds] = useState<ChartMetricId[]>([
    "chainTvl",
    "stableLiquidity",
    "dexVolume",
    "feesPaid",
  ]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>("defi");
  const pickerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!pickerOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPickerOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pickerOpen]);

  const chartMetrics = useMemo(
    () => (analytics ? buildChartMetrics(analytics, chartRange) : []),
    [analytics, chartRange]
  );
  const chartableMetrics = chartMetrics.filter(isChartable);
  const snapshotMetrics = chartMetrics.filter((metric) => !isChartable(metric));
  const selectedMetrics = chartableMetrics.filter((metric) => selectedMetricIds.includes(metric.id));
  const comparisonMetrics = selectedMetrics.length > 0 ? selectedMetrics : chartableMetrics.slice(0, 4);

  function toggleMetric(metric: ChartMetric) {
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
  const snapshotGroups = CATEGORY_ORDER.map((category) => ({
    category,
    metrics: snapshotMetrics.filter((metric) => metric.category === category),
  })).filter((group) => group.metrics.length > 0);

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

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <ShellPanel className="self-start p-4">
          <div className="label-caps text-[var(--color-text-dim)]">MON price</div>
          <div className="mt-2 flex items-baseline gap-3">
            <div className="min-w-0 truncate font-mono text-[28px] font-black leading-none text-[var(--color-text-primary)]">
              {formatCurrency(analytics.market.priceUsd, 6)}
            </div>
            <div className={`shrink-0 font-mono text-[13px] font-black ${toneForPercent(analytics.market.change24hPct) === "negative" ? "text-[var(--color-negative)]" : "text-[var(--color-positive)]"}`}>
              {formatSignedPercent(analytics.market.change24hPct)} 24h
            </div>
          </div>
          <div className="mt-3">
            <MiniSparkline points={analytics.market.priceTrend} color="var(--color-accent-primary)" />
          </div>

          <div className="mt-4">
            <StatRow label="Market cap" value={formatCurrency(analytics.market.marketCapUsd)} />
            <StatRow label="FDV" value={formatCurrency(analytics.market.fdvUsd)} />
            <StatRow label="Token volume" helper="24h" value={formatCurrency(analytics.market.volume24hUsd)} />
            <StatRow label="TVL" helper={`${analytics.defi.protocolTvl.length} protocols`} value={formatCurrency(tvl)} />
            <StatRow
              label="Stablecoins mcap"
              helper={stableLeader ? `${stableLeader.symbol} ${formatPercent(stableLeader.sharePct)}` : undefined}
              value={formatCurrency(analytics.stablecoins.totalUsd)}
            />
            <StatRow label="DEX volume" helper="24h" value={formatCurrency(analytics.dex.volume24hUsd)} />
            <StatRow label="Fees paid" helper="24h" value={formatCurrency(analytics.economy.dailyFeesUsd)} />
            <StatRow
              label="Staked value"
              helper={formatMon(analytics.staking.totalActiveStakeMon)}
              value={formatCurrency(analytics.staking.totalValueStakedUsd)}
            />
            <StatRow
              label="Staking APY"
              value={formatPercent(analytics.staking.estimatedApyPct)}
              tone={analytics.staking.estimatedApyPct && analytics.staking.estimatedApyPct > 8 ? "positive" : undefined}
            />
          </div>
        </ShellPanel>

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
            <div className="relative" ref={pickerRef}>
              <button
                type="button"
                onClick={() => setPickerOpen((current) => !current)}
                aria-expanded={pickerOpen}
                aria-haspopup="dialog"
                className="flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.22)] bg-[rgba(255,255,255,0.025)] px-3 text-[12px] font-black text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-hover)]"
              >
                Add metrics
                <span className="font-mono text-[16px] leading-none">+</span>
              </button>
              {pickerOpen && (
                <MetricPickerModal
                  metrics={chartableMetrics}
                  selectedIds={selectedMetricIds}
                  onToggle={toggleMetric}
                  onClose={() => setPickerOpen(false)}
                />
              )}
            </div>
            {comparisonMetrics.map((metric) => (
              <SelectedMetricPill key={metric.id} metric={metric} onRemove={() => toggleMetric(metric)} />
            ))}
          </div>

          <MultiMetricChart metrics={comparisonMetrics} />
        </ShellPanel>
      </div>

      <ShellPanel className="p-4">
        <SectionHeader eyebrow="Snapshot" title="Latest network stats" />
        <div className="grid gap-4">
          {snapshotGroups.map((group) => (
            <div key={group.category}>
              <div className="label-caps mb-2 text-[var(--color-text-dim)]">{CATEGORY_LABELS[group.category]}</div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                {group.metrics.map((metric) => (
                  <Metric
                    key={metric.id}
                    label={metric.label}
                    value={metric.value}
                    helper={metric.helper}
                    tone={metric.tone}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ShellPanel>

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
