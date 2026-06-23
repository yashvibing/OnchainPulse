"use client";

import { useEffect, useMemo, useState, useId } from "react";
import type {
  AnalyticsBar,
  AnalyticsPayload,
  AnalyticsPoint,
  AnalyticsStablecoin,
  AnalyticsValidator,
} from "@/services/analytics";

type Tone = "positive" | "negative" | "warning" | "neutral";

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
  return new Date(value).toLocaleString(undefined, {
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
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function chartPath(points: AnalyticsPoint[], width = 100, height = 44, padding = 2) {
  if (points.length < 2) return "";
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = padding + (index / (points.length - 1)) * (width - padding * 2);
      const y = height - padding - ((point.value - min) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
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
}: {
  points: AnalyticsPoint[];
  color?: string;
  heightClass?: string;
}) {
  const gradientId = useId();
  const line = chartPath(points);
  const area = line ? `${line} L98,44 L2,44 Z` : "";

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
      aria-label="Trend chart"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0,11 H100 M0,22 H100 M0,33 H100" stroke="rgba(255,255,255,0.07)" strokeWidth="0.3" />
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.05" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function VolumeBars({ points, heightClass = "h-[132px]" }: { points: AnalyticsPoint[]; heightClass?: string }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  if (points.length === 0) {
    return (
      <div className={`flex ${heightClass} items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[13px] text-[var(--color-text-muted)]`}>
        No volume data.
      </div>
    );
  }

  return (
    <div className={`flex ${heightClass} items-end gap-1 rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.24)] bg-[rgba(8,16,13,0.42)] px-2 pb-2 pt-3`}>
      {points.map((point) => (
        <div
          key={`${point.timestamp}-${point.value}`}
          className="flex-1 rounded-t-sm bg-[linear-gradient(180deg,var(--color-accent-secondary),rgba(220,184,255,0.28))] opacity-90"
          style={{ height: `${Math.max(5, (point.value / max) * 100)}%` }}
          title={formatCurrency(point.value)}
        />
      ))}
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
  const visible = typeof limit === "number" ? items.slice(0, limit) : items;
  const max = maxValue || Math.max(...visible.map((item) => item.value), 1);

  if (visible.length === 0) {
    return <div className="text-[13px] text-[var(--color-text-muted)]">No data available.</div>;
  }

  return (
    <div className="space-y-3">
      {visible.map((item) => (
        <div key={item.label} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_128px_auto] sm:items-center">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-bold text-[var(--color-text-primary)]">{item.label}</div>
            {item.detail && <div className="truncate text-[11px] text-[var(--color-text-muted)]">{item.detail}</div>}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-accent-primary),var(--color-accent-violet))]"
              style={{ width: `${Math.max(3, Math.min(100, (item.value / max) * 100))}%` }}
            />
          </div>
          <div className="min-w-0 text-left font-mono text-[13px] text-[var(--color-text-secondary)] sm:text-right">
            {valueFormatter(item.value)}
          </div>
        </div>
      ))}
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

function ValidatorTable({ validators }: { validators: AnalyticsValidator[] }) {
  const visible = validators.slice(0, 12);

  if (visible.length === 0) {
    return <div className="text-[13px] text-[var(--color-text-muted)]">No validator data available.</div>;
  }

  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[var(--color-text-dim)]">
            <th className="py-2 pr-3 font-semibold">Rank</th>
            <th className="py-2 pr-3 font-semibold">Validator</th>
            <th className="py-2 pr-3 text-right font-semibold">Stake</th>
            <th className="py-2 pr-3 text-right font-semibold">Share</th>
            <th className="py-2 pr-3 text-right font-semibold">Commission</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((validator) => (
            <tr key={`${validator.id}-${validator.name}`} className="border-b border-[rgba(255,255,255,0.055)]">
              <td className="py-3 pr-3 font-mono text-[var(--color-text-muted)]">#{validator.rank || "-"}</td>
              <td className="max-w-[280px] truncate py-3 pr-3 font-bold text-[var(--color-text-primary)]">
                {validator.name}
              </td>
              <td className="py-3 pr-3 text-right font-mono text-[var(--color-text-secondary)]">
                {formatMon(validator.stakeMon)}
              </td>
              <td className="py-3 pr-3 text-right font-mono text-[var(--color-text-secondary)]">
                {formatPercent(validator.sharePct, 2)}
              </td>
              <td className="py-3 pr-3 text-right font-mono text-[var(--color-text-secondary)]">
                {formatPercent(validator.commissionPct, 2)}
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
  const [error, setError] = useState("");

  useEffect(() => {
    loadAnalytics()
      .then(setAnalytics)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load analytics."))
      .finally(() => setLoading(false));
  }, []);

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
  const stakingRatio =
    analytics.supply.totalSupplyMon && analytics.supply.lockedOrStakedMon
      ? (analytics.supply.lockedOrStakedMon / analytics.supply.totalSupplyMon) * 100
      : undefined;
  const top10Share = analytics.decentralization.top10SharePct;
  const dataAgeMinutes = Math.round((Date.now() - analytics.generatedAt) / 60000);
  const dataFresh = dataAgeMinutes <= 15;
  const sourceCount = analytics.sources.length;
  const navItems = [
    ["Overview", "#overview"],
    ["Market", "#market"],
    ["Network", "#network"],
    ["DeFi", "#defi"],
    ["Staking", "#staking"],
    ["Validators", "#validators"],
  ];

  return (
    <div className="min-w-0 space-y-5">
      <div className="sticky top-0 z-10 -mx-1 border-b border-[rgba(132,148,142,0.22)] bg-[rgba(8,16,13,0.88)] px-1 py-3 backdrop-blur">
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
      </div>

      <section id="overview" className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatusChip label="Status" value={dataFresh ? "Live" : "Stale"} tone={dataFresh ? "positive" : "warning"} />
        <StatusChip label="Updated" value={timeAgo(analytics.generatedAt)} />
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
            <TrendChart points={analytics.market.priceTrend} color="var(--color-accent-secondary)" heightClass="h-[300px]" />
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
          label="Validator concentration"
          value={formatPercent(top10Share, 2)}
          detail="Stake controlled by the top 10 validators."
          tone={typeof top10Share === "number" && top10Share > 50 ? "warning" : "neutral"}
        />
        <InsightCard
          label="Staking ratio"
          value={formatPercent(stakingRatio, 1)}
          detail="Estimated locked or actively staked supply."
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
          <VolumeBars points={analytics.economy.feeTrend} />
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
        </SectionPanel>

        <SectionPanel eyebrow="DEX flow" title="Volume, fees, and efficiency">
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniMetric label="24h volume" value={formatCurrency(analytics.dex.volume24hUsd)} />
            <MiniMetric label="7d volume" value={formatCurrency(analytics.dex.volume7dUsd)} />
            <MiniMetric label="24h fees" value={formatCurrency(analytics.dex.fees24hUsd)} />
            <MiniMetric label="Volume / TVL" value={formatPercent(analytics.dex.volumeToTvlPct, 2)} />
          </div>
          <div className="mt-5">
            <VolumeBars points={analytics.dex.volumeTrend} />
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

      <div id="staking" className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <SectionPanel eyebrow="Staking and supply" title="Security budget and token float">
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniMetric label="Active validators" value={`${formatNumber(analytics.staking.activeValidators)} / ${formatNumber(analytics.staking.activeSetCap)}`} />
            <MiniMetric label="Active stake" value={formatMon(analytics.staking.totalActiveStakeMon)} />
            <MiniMetric label="Value staked" value={formatCurrency(analytics.staking.totalValueStakedUsd)} />
            <MiniMetric label="Est. APY" value={formatPercent(analytics.staking.estimatedApyPct, 1)} />
            <MiniMetric label="Total supply" value={formatMon(analytics.supply.totalSupplyMon)} />
            <MiniMetric label="Circulating" value={formatMon(analytics.supply.circulatingSupplyMon)} helper={formatPercent(analytics.supply.circulatingPct, 2)} />
          </div>
        </SectionPanel>

        <SectionPanel eyebrow="Decentralization" title="Validator concentration and distribution">
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniMetric label="Liveness Nakamoto" value={formatNumber(analytics.decentralization.nakamotoLiveness)} />
            <MiniMetric label="Safety Nakamoto" value={formatNumber(analytics.decentralization.nakamotoSafety)} />
            <MiniMetric label="Top 10 share" value={formatPercent(analytics.decentralization.top10SharePct)} />
            <MiniMetric label="Gini / HHI" value={`${formatNumber(analytics.decentralization.gini, 3)} / ${formatNumber(analytics.decentralization.hhi, 0)}`} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <div className="mb-3 text-[13px] font-bold text-[var(--color-text-secondary)]">Countries</div>
              <BarList items={analytics.decentralization.countries} valueFormatter={(value) => formatPercent(value, 1)} limit={6} />
            </div>
            <div>
              <div className="mb-3 text-[13px] font-bold text-[var(--color-text-secondary)]">Infrastructure providers</div>
              <BarList items={analytics.decentralization.providers} valueFormatter={(value) => formatPercent(value, 1)} limit={6} />
            </div>
          </div>
        </SectionPanel>
      </div>

      <SectionPanel id="validators" eyebrow="Active set" title="Top validators">
        <ValidatorTable validators={analytics.validators} />
      </SectionPanel>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-4 py-3 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
        <span className="font-bold text-[var(--color-text-secondary)]">Data sources:</span> {sourceLine || "Unavailable"}.
        <span className="ml-2">Refreshed {formatDateTime(analytics.generatedAt)}.</span>
      </div>
    </div>
  );
}
