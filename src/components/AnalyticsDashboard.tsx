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
    <section className={`rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="label-caps text-[var(--color-accent-primary)]">{title}</h2>
        {meta && <span className="label-caps text-[var(--color-text-dim)]">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-4 py-3">
      <div className="label-caps text-[var(--color-text-dim)]">{label}</div>
      <div className="mt-2 text-[24px] font-black tracking-[-0.02em] text-[var(--color-text-primary)]">
        {value}
      </div>
      {helper && <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">{helper}</div>}
    </div>
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
        <div key={item.label} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-center">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-bold text-[var(--color-text-primary)]">
              {item.label}
            </div>
            {item.detail && (
              <div className="text-[11px] text-[var(--color-text-muted)]">{item.detail}</div>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent-primary)]"
              style={{ width: `${Math.max(3, Math.min(100, (item.value / max) * 100))}%` }}
            />
          </div>
          <div className="text-right font-mono text-[13px] text-[var(--color-text-secondary)]">
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
    <svg viewBox="0 0 100 44" className="h-[220px] w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="analytics-line-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#analytics-line-fill)" />
      <path d={line} fill="none" stroke={color} strokeWidth="0.8" />
    </svg>
  );
}

function VolumeBars({ points }: { points: AnalyticsPoint[] }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  if (points.length === 0) return <div className="text-[13px] text-[var(--color-text-muted)]">No volume data.</div>;

  return (
    <div className="flex h-[120px] items-end gap-1 border-b border-[var(--color-border)] pb-1">
      {points.map((point) => (
        <div
          key={`${point.timestamp}-${point.value}`}
          className="flex-1 rounded-t-sm bg-[var(--color-accent-secondary)] opacity-80"
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] text-left text-[13px]">
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
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="h-44 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
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
    <div className="space-y-5">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3">
        <div className="grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <MetricCard label="MON price" value={formatCurrency(analytics.market.priceUsd, 6)} />
          <MetricCard
            label="24 hr"
            value={formatSignedPercent(analytics.market.change24hPct)}
            helper={positive24 ? "price up" : "price down"}
          />
          <MetricCard
            label="30 day"
            value={formatSignedPercent(analytics.market.change30dPct)}
            helper={positive30 ? "price up" : "price down"}
          />
          <MetricCard label="Market cap" value={formatCurrency(analytics.market.marketCapUsd)} />
          <MetricCard label="FDV" value={formatCurrency(analytics.market.fdvUsd)} />
          <MetricCard label="24 hr volume" value={formatCurrency(analytics.market.volume24hUsd)} />
          <MetricCard label="Open interest" value={formatCurrency(analytics.market.openInterestUsd)} />
          <MetricCard label="Block height" value={formatNumber(analytics.network.blockHeight)} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]">
        <Panel title="Price action" meta="MON / USD">
          <LineChart points={analytics.market.priceTrend} color="var(--color-accent-secondary)" />
        </Panel>

        <Panel title="Staking">
          <div className="grid gap-3 sm:grid-cols-2">
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

      <div className="grid gap-5 lg:grid-cols-3">
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

      <div className="grid gap-5 lg:grid-cols-3">
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

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Chain fees & revenue">
          <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="24h volume" value={formatCurrency(analytics.dex.volume24hUsd)} />
            <MetricCard label="DEX TVL" value={formatCurrency(analytics.dex.tvlUsd)} />
            <MetricCard label="Vol / TVL" value={formatPercent(analytics.dex.volumeToTvlPct, 2)} />
            <MetricCard label="7d volume" value={formatCurrency(analytics.dex.volume7dUsd)} />
            <MetricCard label="24h fees" value={formatCurrency(analytics.dex.fees24hUsd)} />
            <MetricCard label="Fees / TVL" value={formatPercent(analytics.dex.feesToTvlPct, 2)} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="DeFi TVL distribution" meta="displayed markets">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <MetricCard label="Chain TVL" value={formatCurrency(analytics.defi.totalChainTvlUsd)} />
            <MetricCard label="Displayed TVL" value={formatCurrency(analytics.defi.totalTvlUsd)} />
          </div>
          <BarList items={analytics.defi.protocolTvl} valueFormatter={formatCurrency} />
        </Panel>

        <Panel title="TVL categories" meta="displayed markets">
          <BarList items={analytics.defi.categoryTvl} valueFormatter={formatCurrency} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
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

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Stablecoins on Monad" meta="all time">
          <MetricCard label="Total" value={formatCurrency(analytics.stablecoins.totalUsd)} />
          <div className="mt-4">
            <StablecoinTable stablecoins={analytics.stablecoins.assets} />
          </div>
        </Panel>
        <Panel title="Supply ratio">
          <div className="grid gap-3 sm:grid-cols-2">
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

      <Panel title="Monad improvement proposals" meta="forum">
        <div className="space-y-2">
          {analytics.mips.length === 0 ? (
            <div className="text-[13px] text-[var(--color-text-muted)]">No MIP data available.</div>
          ) : analytics.mips.map((mip) => (
            <a
              key={mip.number}
              href={mip.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-3 hover:border-[var(--color-border-hover)]"
            >
              <div className="min-w-0">
                <div className="font-mono text-[13px] font-bold text-[var(--color-accent-secondary)]">
                  MIP-{mip.number}
                </div>
                <div className="truncate text-[14px] font-bold text-[var(--color-text-primary)]">
                  {mip.title}
                </div>
              </div>
              <div className="shrink-0 text-[11px] text-[var(--color-text-muted)]">{mip.activity}</div>
            </a>
          ))}
        </div>
      </Panel>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-4 py-3 text-[12px] text-[var(--color-text-muted)]">
        Sources: {sourceLine}. Last loaded {new Date(analytics.generatedAt).toLocaleString()}.
      </div>
    </div>
  );
}
