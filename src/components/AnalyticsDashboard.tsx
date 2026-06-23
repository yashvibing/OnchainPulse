"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AnalyticsBar,
  AnalyticsPayload,
  AnalyticsPoint,
  AnalyticsStablecoin,
} from "@/services/analytics";

function formatCurrency(value?: number, maximumFractionDigits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value > 0 && value < 0.01) return `$${value.toFixed(6)}`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits })}`;
}

function formatMon(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B MON`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M MON`;
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

function Panel({
  title,
  meta,
  children,
  className = "",
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(25,33,30,0.98),rgba(13,21,18,0.92))] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="label-caps min-w-0 text-[var(--color-accent-primary)]">{title}</h2>
        {meta && <span className="label-caps shrink-0 text-[var(--color-text-dim)]">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.34)] bg-[rgba(8,16,13,0.58)] px-4 py-3">
      <div className="label-caps text-[var(--color-text-dim)]">{label}</div>
      <div className="mt-2 break-words text-[clamp(20px,1.8vw,24px)] font-black leading-tight tracking-[-0.01em] text-[var(--color-text-primary)]">
        {value}
      </div>
      {helper && <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">{helper}</div>}
    </div>
  );
}

function HeroMetric({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "neutral" | "positive" | "warning";
}) {
  const toneClass =
    tone === "positive"
      ? "text-[var(--color-positive)]"
      : tone === "warning"
        ? "text-[var(--color-warning)]"
        : "text-[var(--color-text-primary)]";

  return (
    <div className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(8,16,13,0.72)] p-4">
      <div className="label-caps text-[var(--color-text-dim)]">{label}</div>
      <div className={`mt-2 text-[clamp(26px,3vw,40px)] font-black leading-none ${toneClass}`}>
        {value}
      </div>
      {helper && (
        <div className="mt-2 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
          {helper}
        </div>
      )}
    </div>
  );
}

function TrendBadge({ value }: { value?: number }) {
  const positive = (value || 0) >= 0;
  return (
    <span
      className={`rounded-[var(--radius-md)] border px-2.5 py-1 font-mono text-[12px] font-bold ${
        positive
          ? "border-[rgba(0,245,204,0.42)] bg-[rgba(0,245,204,0.08)] text-[var(--color-positive)]"
          : "border-[rgba(255,180,171,0.42)] bg-[rgba(255,180,171,0.08)] text-[var(--color-negative)]"
      }`}
    >
      {formatSignedPercent(value)}
    </span>
  );
}

function BarList({
  items,
  valueFormatter,
  maxValue,
}: {
  items: AnalyticsBar[];
  valueFormatter: (value: number) => string;
  maxValue?: number;
}) {
  const max = maxValue || Math.max(...items.map((item) => item.value), 1);
  if (items.length === 0) {
    return <div className="text-[13px] text-[var(--color-text-muted)]">No data available.</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-center">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-bold text-[var(--color-text-primary)]">
              {item.label}
            </div>
            {item.detail && (
              <div className="break-words text-[11px] text-[var(--color-text-muted)]">{item.detail}</div>
            )}
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

function LineChart({ points, color = "var(--color-accent-primary)" }: { points: AnalyticsPoint[]; color?: string }) {
  const line = chartPath(points);
  const area = line ? `${line} L98,44 L2,44 Z` : "";

  if (!line) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[13px] text-[var(--color-text-muted)]">
        Chart unavailable.
      </div>
    );
  }

  return (
    <svg viewBox="0 0 100 44" className="h-[220px] w-full rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.24)] bg-[rgba(8,16,13,0.35)]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="analytics-line-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0,11 H100 M0,22 H100 M0,33 H100" stroke="rgba(255,255,255,0.06)" strokeWidth="0.3" />
      <path d={area} fill="url(#analytics-line-fill)" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.05" />
    </svg>
  );
}

function VolumeBars({ points }: { points: AnalyticsPoint[] }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  if (points.length === 0) return <div className="text-[13px] text-[var(--color-text-muted)]">No volume data.</div>;

  return (
    <div className="flex h-[120px] items-end gap-1 rounded-[var(--radius-md)] border border-[rgba(132,148,142,0.24)] bg-[rgba(8,16,13,0.35)] px-2 pb-2 pt-3">
      {points.map((point) => (
        <div
          key={`${point.timestamp}-${point.value}`}
          className="flex-1 rounded-t-sm bg-[linear-gradient(180deg,var(--color-accent-secondary),rgba(0,245,204,0.22))] opacity-90"
          style={{ height: `${Math.max(6, (point.value / max) * 100)}%` }}
          title={formatCurrency(point.value)}
        />
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] sm:h-44" />
        ))}
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

  const positive24 = (analytics.market.change24hPct || 0) >= 0;
  const positive30 = (analytics.market.change30dPct || 0) >= 0;

  return (
    <div className="min-w-0 space-y-5">
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[linear-gradient(135deg,rgba(0,245,204,0.1),rgba(220,184,255,0.07)_38%,rgba(13,21,18,0.98)_72%)] p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="label-caps text-[var(--color-accent-primary)]">
              Live network console
            </div>
            <h2 className="mt-3 text-[28px] font-black text-[var(--color-text-primary)] md:text-[42px]">
              Monad pulse at a glance
            </h2>
            <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              Market structure, staking security, liquidity depth, fee flow,
              and rate opportunities stitched together from public sources.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-[var(--radius-md)] border border-[rgba(0,245,204,0.38)] bg-[rgba(0,245,204,0.08)] px-3 py-2 text-[12px] font-bold text-[var(--color-positive)]">
              RPC block {formatNumber(analytics.network.blockHeight)}
            </span>
            <span className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(8,16,13,0.55)] px-3 py-2 text-[12px] text-[var(--color-text-muted)]">
              Updated {formatDateTime(analytics.generatedAt)}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <HeroMetric
            label="MON price"
            value={formatCurrency(analytics.market.priceUsd, 6)}
            helper="Native asset price"
            tone={positive24 ? "positive" : "warning"}
          />
          <HeroMetric
            label="24h move"
            value={formatSignedPercent(analytics.market.change24hPct)}
            helper={positive24 ? "Momentum is positive" : "Momentum is cooling"}
            tone={positive24 ? "positive" : "warning"}
          />
          <HeroMetric
            label="Chain TVL"
            value={formatCurrency(analytics.defi.totalChainTvlUsd ?? analytics.defi.totalTvlUsd)}
            helper="DefiLlama chain view"
          />
          <HeroMetric
            label="Active stake"
            value={formatMon(analytics.staking.totalActiveStakeMon)}
            helper={`${formatNumber(analytics.staking.activeValidators)} validators`}
          />
        </div>
      </section>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <Panel
          title="Price action"
          meta={`24h ${formatSignedPercent(analytics.market.change24hPct)}`}
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <MetricCard label="Market cap" value={formatCurrency(analytics.market.marketCapUsd)} />
            <MetricCard label="FDV" value={formatCurrency(analytics.market.fdvUsd)} />
            <MetricCard label="Open interest" value={formatCurrency(analytics.market.openInterestUsd)} />
          </div>
          <LineChart points={analytics.market.priceTrend} color="var(--color-accent-secondary)" />
        </Panel>

        <Panel title="Staking security" meta={positive30 ? "30d up" : "30d down"}>
          <div className="mb-4 flex flex-wrap gap-2">
            <TrendBadge value={analytics.market.change30dPct} />
            <span className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-2.5 py-1 font-mono text-[12px] text-[var(--color-text-muted)]">
              Epoch {formatNumber(analytics.network.epoch)}
            </span>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <MetricCard label="Active validators" value={`${formatNumber(analytics.staking.activeValidators)} / ${formatNumber(analytics.staking.activeSetCap)}`} />
            <MetricCard label="Total active stake" value={formatMon(analytics.staking.totalActiveStakeMon)} />
            <MetricCard label="Value staked" value={formatCurrency(analytics.staking.totalValueStakedUsd)} />
            <MetricCard
              label="Est. APY"
              value={formatPercent(analytics.staking.estimatedApyPct, 1)}
              helper={
                analytics.staking.minApyPct && analytics.staking.maxApyPct
                  ? `${formatPercent(analytics.staking.minApyPct, 1)}-${formatPercent(analytics.staking.maxApyPct, 1)} range`
                  : undefined
              }
            />
            <MetricCard label="Mean commission" value={formatPercent(analytics.staking.meanCommissionPct, 1)} />
            <MetricCard label="At commission cap" value={formatNumber(analytics.staking.atCommissionCap)} />
          </div>
        </Panel>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-3">
        <Panel title="Supply metrics">
          <div className="grid gap-3">
            <MetricCard label="Total supply" value={formatMon(analytics.supply.totalSupplyMon)} />
            <MetricCard
              label="Circulating supply"
              value={formatMon(analytics.supply.circulatingSupplyMon)}
              helper={formatPercent(analytics.supply.circulatingPct, 2)}
            />
            <MetricCard label="Locked / staked" value={formatMon(analytics.supply.lockedOrStakedMon)} />
          </div>
        </Panel>

        <Panel title="Staking mechanics">
          <div className="grid gap-3">
            <MetricCard label="Active nodes" value={formatNumber(analytics.staking.activeNodes)} />
            <MetricCard
              label="Unbonding"
              value={
                typeof analytics.staking.unbondingHours === "number"
                  ? `${analytics.staking.unbondingHours}h`
                  : "-"
              }
              helper="1 epoch"
            />
            <MetricCard
              label="Epoch delay"
              value={analytics.network.inEpochDelayPeriod ? "Active" : "Clear"}
              helper="staking precompile"
            />
          </div>
        </Panel>

        <Panel title="Network economy">
          <div className="grid gap-3">
            <MetricCard label="Inflation rate" value={formatPercent(analytics.economy.inflationRatePct, 2)} />
            <MetricCard label="Burn est. 24h" value={formatMon(analytics.economy.burnRate24hMon)} helper="recent blocks" />
            <MetricCard label="Block reward" value={formatMon(analytics.economy.blockRewardMon)} />
            <MetricCard label="Net emission 24h" value={formatMon(analytics.economy.netEmission24hMon)} />
            <MetricCard label="Net emission / yr" value={formatMon(analytics.economy.netEmissionYearMon)} />
          </div>
        </Panel>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-3">
        <Panel title="Network">
          <div className="grid gap-3">
            <MetricCard label="Gas" value={`${formatNumber(analytics.network.gasGwei, 4)} gwei`} />
            <MetricCard label="Block time" value={analytics.network.blockTimeSeconds ? `${analytics.network.blockTimeSeconds}s` : "-"} />
            <MetricCard label="Finality" value={analytics.network.finalitySeconds ? `${analytics.network.finalitySeconds}s` : "-"} />
            <MetricCard
              label="Epoch"
              value={formatNumber(analytics.network.epoch)}
              helper={analytics.network.inEpochDelayPeriod ? "delay period" : "normal period"}
            />
          </div>
        </Panel>

        <Panel title="Decentralization">
          <div className="grid gap-3">
            <MetricCard label="Liveness Nakamoto" value={formatNumber(analytics.decentralization.nakamotoLiveness)} />
            <MetricCard label="Safety Nakamoto" value={formatNumber(analytics.decentralization.nakamotoSafety)} />
            <MetricCard label="Top 10 stake share" value={formatPercent(analytics.decentralization.top10SharePct)} />
            <MetricCard label="Gini / HHI" value={`${formatNumber(analytics.decentralization.gini, 3)} / ${formatNumber(analytics.decentralization.hhi, 0)}`} />
          </div>
        </Panel>

        <Panel title="DEX volume" meta="30 day">
          <MetricCard label="24 hr volume" value={formatCurrency(analytics.dex.volume24hUsd ?? analytics.market.volume24hUsd)} />
          <div className="mt-4">
            <VolumeBars points={analytics.dex.volumeTrend} />
          </div>
          <div className="mt-3 text-[12px] text-[var(--color-text-muted)]">
            Bars show daily DEX volume from DefiLlama.
          </div>
        </Panel>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <Panel title="Chain fees & revenue">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <MetricCard label="Daily fees" value={formatCurrency(analytics.economy.dailyFeesUsd)} />
            <MetricCard label="Ann. fees" value={formatCurrency(analytics.economy.annualizedFeesUsd)} />
            <MetricCard label="P/S ratio" value={analytics.economy.psRatio ? `${formatNumber(analytics.economy.psRatio, 0)}x` : "-"} />
            <MetricCard label="P/F ratio" value={analytics.economy.pfRatio ? `${formatNumber(analytics.economy.pfRatio, 0)}x` : "-"} />
          </div>
          <div className="mt-4">
            <VolumeBars points={analytics.economy.feeTrend} />
          </div>
        </Panel>

        <Panel title="DEX efficiency">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <MetricCard label="24h volume" value={formatCurrency(analytics.dex.volume24hUsd)} />
            <MetricCard label="DEX TVL" value={formatCurrency(analytics.dex.tvlUsd)} />
            <MetricCard label="Vol / TVL" value={formatPercent(analytics.dex.volumeToTvlPct, 2)} />
            <MetricCard label="7d volume" value={formatCurrency(analytics.dex.volume7dUsd)} />
            <MetricCard label="24h fees" value={formatCurrency(analytics.dex.fees24hUsd)} />
            <MetricCard label="Fees / TVL" value={formatPercent(analytics.dex.feesToTvlPct, 2)} />
          </div>
        </Panel>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <Panel title="DeFi TVL distribution" meta="displayed markets">
          <div className="mb-4 grid min-w-0 gap-3 sm:grid-cols-2">
            <MetricCard label="Chain TVL" value={formatCurrency(analytics.defi.totalChainTvlUsd)} />
            <MetricCard label="Displayed TVL" value={formatCurrency(analytics.defi.totalTvlUsd)} />
          </div>
          <BarList items={analytics.defi.protocolTvl} valueFormatter={formatCurrency} />
        </Panel>

        <Panel title="TVL categories" meta="displayed markets">
          <BarList items={analytics.defi.categoryTvl} valueFormatter={formatCurrency} />
        </Panel>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <Panel title="DEX liquidity">
          <BarList items={analytics.defi.topDexLiquidity} valueFormatter={formatCurrency} />
        </Panel>

        <Panel title="Top DEX volume" meta="24 hr">
          <BarList items={analytics.dex.topProtocols} valueFormatter={formatCurrency} />
        </Panel>
      </div>

      <Panel title="Top displayed rates">
        <BarList
          items={analytics.defi.topRates}
          valueFormatter={(value) => `${value.toFixed(2)}% APR`}
        />
      </Panel>

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <Panel title="Stablecoins on Monad" meta="all time">
          <MetricCard label="Total" value={formatCurrency(analytics.stablecoins.totalUsd)} />
          <div className="mt-4">
            <StablecoinTable stablecoins={analytics.stablecoins.assets} />
          </div>
        </Panel>
        <Panel title="Supply ratio">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <MetricCard
              label="Staking ratio"
              value={
                analytics.supply.totalSupplyMon && analytics.supply.lockedOrStakedMon
                  ? formatPercent((analytics.supply.lockedOrStakedMon / analytics.supply.totalSupplyMon) * 100, 1)
                  : "-"
              }
            />
            <MetricCard
              label="Circulating"
              value={formatPercent(analytics.supply.circulatingPct, 2)}
              helper={formatMon(analytics.supply.circulatingSupplyMon)}
            />
          </div>
        </Panel>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-4 py-3 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
        Sources: {sourceLine}. Refreshed {formatDateTime(analytics.generatedAt)}.
      </div>
    </div>
  );
}
