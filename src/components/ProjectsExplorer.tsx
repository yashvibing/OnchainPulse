"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatNumber } from "@/lib/format";
import type { MonadMarket, MonadProjectsResponse } from "@/services/projects";

type SortField = "deposits" | "liquidity" | "apy" | "utilization";
type SortDirection = "desc" | "asc";
type ActionFilter = "All" | "LEND" | "BORROW";

function formatUsd(value: number | null) {
  if (value === null) return "-";
  if (value >= 1_000_000_000) return `$${formatNumber(value / 1_000_000_000, 2)}B`;
  if (value >= 1_000_000) return `$${formatNumber(value / 1_000_000, 2)}M`;
  if (value >= 1_000) return `$${formatNumber(value / 1_000, 2)}K`;
  return `$${formatNumber(value, 0)}`;
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  return `${value.toFixed(2)}%`;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updated just now";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60_000));
  if (diffMinutes < 1) return "Updated just now";
  if (diffMinutes === 1) return "Updated 1 min ago";
  if (diffMinutes < 60) return `Updated ${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  return diffHours === 1 ? "Updated 1 hour ago" : `Updated ${diffHours} hours ago`;
}

function ProtocolAvatar({ market }: { market: MonadMarket }) {
  const initials = market.protocol
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className="h-7 w-7 shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.06)] bg-cover bg-center"
      style={market.protocolLogo ? { backgroundImage: `url(${market.protocolLogo})` } : undefined}
      aria-hidden="true"
    >
      {!market.protocolLogo && (
        <div className="flex h-full w-full items-center justify-center text-[9px] font-bold text-[var(--color-text-secondary)]">
          {initials || "P"}
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = sortField === field;
  const arrow = isActive && sortDirection === "asc" ? "^" : "v";

  return (
    <button
      type="button"
      aria-label={`Sort ${label}`}
      onClick={() => onSort(field)}
      className={`ml-auto flex items-center justify-end gap-2 rounded-[var(--radius-sm)] px-1 py-0.5 transition-colors ${
        isActive
          ? "text-[var(--color-positive)]"
          : "text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)]"
      }`}
    >
      <span>{label}</span>
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-[var(--radius-sm)] border text-[10px] ${
          isActive
            ? "border-[var(--color-accent-primary)]"
            : "border-[var(--color-border)]"
        }`}
      >
        {arrow}
      </span>
    </button>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "positive" }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-[var(--color-text-dim)]">{label}</div>
      <div
        className={`mt-1 font-mono text-[13px] font-semibold ${
          tone === "positive" ? "text-[var(--color-positive)]" : "text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: MonadMarket["action"] }) {
  return (
    <span
      className={`w-fit rounded-[var(--radius-sm)] px-2 py-1 text-[10px] font-bold uppercase ${
        action === "LEND"
          ? "bg-[rgba(0,232,123,0.1)] text-[var(--color-positive)]"
          : "bg-[rgba(59,130,246,0.12)] text-[var(--color-accent-secondary)]"
      }`}
    >
      {action === "LEND" ? "Lend" : "Borrow"}
    </span>
  );
}

function MarketRow({
  market,
  onDetails,
}: {
  market: MonadMarket;
  onDetails: (market: MonadMarket) => void;
}) {
  return (
    <tr className="border-b border-[rgba(255,255,255,0.05)] last:border-b-0">
      <td className="sticky left-0 z-10 bg-[#0A0E17] px-4 py-4 shadow-[12px_0_18px_rgba(10,14,23,0.65)]">
        <div className="flex min-w-[210px] items-center">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-[var(--color-text-primary)]">
              {market.assetLabel}
            </div>
            <div className="truncate text-[11px] text-[var(--color-text-dim)]">
              {market.opportunityName}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex min-w-[150px] items-center gap-2">
          <ProtocolAvatar market={market} />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[12px] font-semibold uppercase text-[var(--color-text-secondary)]">
              {market.protocol}
            </span>
            <span className="truncate text-[10px] uppercase text-[var(--color-text-dim)]">
              {market.category}
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-right font-mono text-[14px] font-semibold text-[var(--color-text-primary)]">
        {formatUsd(market.depositsUsd)}
        {market.borrowedUsd > 0 && market.action === "LEND" && (
          <div className="mt-1 text-[10px] font-normal text-[var(--color-text-dim)]">
            {formatUsd(market.borrowedUsd)} borrowed
          </div>
        )}
      </td>
      <td className="px-4 py-4 text-right font-mono text-[14px] font-semibold text-[var(--color-text-primary)]">
        {market.action === "BORROW" ? formatUsd(market.borrowedUsd) : formatUsd(market.liquidityUsd)}
        {market.action === "BORROW" && (
          <div className="mt-1 text-[10px] font-normal text-[var(--color-text-dim)]">
            borrowed
          </div>
        )}
      </td>
      <td className="px-4 py-4 text-right">
        <div className="text-[14px] font-semibold text-[var(--color-positive)]">
          {formatPercent(market.apy)}
        </div>
        <div className="mt-1 text-[10px] uppercase text-[var(--color-text-dim)]">
          {market.action === "BORROW" ? "Borrow" : "Lend"} APR
        </div>
      </td>
      <td className="px-4 py-4 text-right font-mono text-[14px] font-semibold text-[var(--color-text-primary)]">
        {formatPercent(market.utilization)}
      </td>
      <td className="px-4 py-4 text-right">
        <button
          type="button"
          onClick={() => onDetails(market)}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
        >
          Details
        </button>
      </td>
    </tr>
  );
}

function MarketCard({
  market,
  onDetails,
}: {
  market: MonadMarket;
  onDetails: (market: MonadMarket) => void;
}) {
  return (
    <article className="card px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-[var(--color-text-primary)]">
              {market.assetLabel}
            </div>
            <div className="truncate text-[11px] text-[var(--color-text-dim)]">
              {market.opportunityName}
            </div>
          </div>
        </div>
        <ActionBadge action={market.action} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <ProtocolAvatar market={market} />
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold uppercase text-[var(--color-text-secondary)]">
            {market.protocol}
          </div>
          <div className="truncate text-[10px] uppercase text-[var(--color-text-dim)]">
            {market.category}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric label="Deposits" value={formatUsd(market.depositsUsd)} />
        <Metric
          label={market.action === "BORROW" ? "Borrowed" : "Liquidity"}
          value={market.action === "BORROW" ? formatUsd(market.borrowedUsd) : formatUsd(market.liquidityUsd)}
        />
        <Metric label="APY" value={formatPercent(market.apy)} tone="positive" />
        <Metric label="Utilization" value={formatPercent(market.utilization)} />
      </div>

      <button
        type="button"
        onClick={() => onDetails(market)}
        className="mt-4 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
      >
        Details
      </button>
    </article>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.05)] py-3 last:border-b-0">
      <span className="text-[11px] uppercase text-[var(--color-text-dim)]">{label}</span>
      <span className="text-right text-[13px] font-semibold text-[var(--color-text-primary)]">
        {value}
      </span>
    </div>
  );
}

function MarketDetailsDrawer({
  market,
  onClose,
}: {
  market: MonadMarket | null;
  onClose: () => void;
}) {
  if (!market) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close market details"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-[420px] overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[20px] font-bold text-[var(--color-text-primary)]">
                {market.assetLabel}
              </h2>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                {market.opportunityName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[14px] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
          >
            x
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] px-3 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <ProtocolAvatar market={market} />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
                {market.protocol}
              </div>
              <div className="truncate text-[10px] uppercase text-[var(--color-text-dim)]">
                {market.category}
              </div>
            </div>
          </div>
          <ActionBadge action={market.action} />
        </div>

        <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4">
          <DetailRow label="Deposits" value={formatUsd(market.depositsUsd)} />
          <DetailRow
            label={market.action === "BORROW" ? "Borrowed" : "Liquidity"}
            value={market.action === "BORROW" ? formatUsd(market.borrowedUsd) : formatUsd(market.liquidityUsd)}
          />
          <DetailRow label="APY" value={formatPercent(market.apy)} />
          <DetailRow label="Base APR" value={formatPercent(market.baseApr)} />
          <DetailRow label="Reward APR" value={formatPercent(market.rewardApr)} />
          <DetailRow label="Utilization" value={formatPercent(market.utilization)} />
          <DetailRow label="Tokens" value={market.tokens.slice(0, 6).join(", ") || "-"} />
        </div>

        <div className="mt-5 grid gap-3">
          {market.detailUrl && (
            <a
              href={market.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-4 py-3 text-center text-[13px] font-bold text-[#07110C] transition-opacity hover:opacity-90"
            >
              Open Market
            </a>
          )}
          {market.protocolUrl && (
            <a
              href={market.protocolUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-center text-[13px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
            >
              Open Protocol
            </a>
          )}
        </div>
      </aside>
    </div>
  );
}

function MarketsSkeleton() {
  return (
    <div>
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card px-4 py-3">
            <div className="h-3 w-20 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
            <div className="mt-3 h-7 w-28 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
          </div>
        ))}
      </section>

      <section className="mb-4 grid gap-3 md:grid-cols-[1fr_160px_170px]">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-11 animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)]"
          />
        ))}
      </section>

      <div className="card overflow-hidden">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b border-[rgba(255,255,255,0.05)] px-4 py-4 last:border-b-0"
          >
            <div className="h-10 w-10 animate-pulse rounded-full bg-[rgba(255,255,255,0.08)]" />
            <div className="flex-1">
              <div className="h-4 w-32 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
              <div className="mt-2 h-3 w-56 animate-pulse rounded bg-[rgba(255,255,255,0.05)]" />
            </div>
            <div className="hidden h-5 w-24 animate-pulse rounded bg-[rgba(255,255,255,0.08)] md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectsExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasSyncedUrl = useRef(false);
  const [data, setData] = useState<MonadProjectsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [asset, setAsset] = useState(() => searchParams.get("asset") || "All");
  const [category, setCategory] = useState(() => searchParams.get("category") || "All");
  const [action, setAction] = useState<ActionFilter>(() => {
    const value = searchParams.get("action");
    return value === "LEND" || value === "BORROW" ? value : "All";
  });
  const [sortField, setSortField] = useState<SortField>(() => {
    const value = searchParams.get("sort");
    return value === "liquidity" || value === "apy" || value === "utilization"
      ? value
      : "deposits";
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() =>
    searchParams.get("dir") === "asc" ? "asc" : "desc"
  );
  const [selectedMarket, setSelectedMarket] = useState<MonadMarket | null>(null);

  useEffect(() => {
    fetch("/api/monad-projects")
      .then((response) => {
        if (!response.ok) throw new Error("Failed to fetch projects");
        return response.json();
      })
      .then((nextData: MonadProjectsResponse) => {
        setData(nextData);
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        setError("Project data is temporarily unavailable.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!hasSyncedUrl.current) {
      hasSyncedUrl.current = true;
      return;
    }

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (asset !== "All") params.set("asset", asset);
    if (category !== "All") params.set("category", category);
    if (action !== "All") params.set("action", action);
    if (sortField !== "deposits") params.set("sort", sortField);
    if (sortDirection !== "desc") params.set("dir", sortDirection);

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [action, asset, category, pathname, query, router, sortDirection, sortField]);

  const assets = useMemo(() => {
    const values = data?.markets.map((market) => market.asset).filter(Boolean) || [];
    return ["All", ...[...new Set(values)].sort((a, b) => a.localeCompare(b))];
  }, [data]);

  const categories = useMemo(() => {
    const values = data?.markets.map((market) => market.category).filter(Boolean) || [];
    return ["All", ...[...new Set(values)].sort((a, b) => a.localeCompare(b))];
  }, [data]);

  const filteredMarkets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const markets = data?.markets || [];

    return markets
      .filter((market) => {
        const matchesQuery =
          !normalizedQuery ||
          market.asset.toLowerCase().includes(normalizedQuery) ||
          market.protocol.toLowerCase().includes(normalizedQuery) ||
          market.category.toLowerCase().includes(normalizedQuery) ||
          market.opportunityName.toLowerCase().includes(normalizedQuery);
        const matchesAsset = asset === "All" || market.asset === asset;
        const matchesCategory = category === "All" || market.category === category;
        const matchesAction = action === "All" || market.action === action;
        return matchesQuery && matchesAsset && matchesCategory && matchesAction;
      })
      .sort((a, b) => {
        const getValue = (market: MonadMarket) => {
          if (sortField === "liquidity") return market.liquidityUsd;
          if (sortField === "apy") return market.apy;
          if (sortField === "utilization") return market.utilization;
          return market.depositsUsd;
        };
        const aValue = getValue(a);
        const bValue = getValue(b);

        if (aValue === null && bValue === null) return a.protocol.localeCompare(b.protocol);
        if (aValue === null) return 1;
        if (bValue === null) return -1;

        return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
      });
  }, [action, asset, category, data, query, sortDirection, sortField]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((direction) => (direction === "desc" ? "asc" : "desc"));
      return;
    }

    setSortField(field);
    setSortDirection("desc");
  };

  if (loading) return <MarketsSkeleton />;

  if (error || !data) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-8 text-center">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          {error || "Project data is unavailable."}
        </p>
        <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
          DefiLlama or Merkl may be slow. Try again in a moment.
        </p>
      </div>
    );
  }

  return (
    <div>
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase text-[var(--color-text-dim)]">Tracked TVL</div>
          <div className="mt-1 text-[22px] font-bold text-[var(--color-text-primary)]">
            {formatUsd(data.totals.tvlUsd)}
          </div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase text-[var(--color-text-dim)]">Protocols</div>
          <div className="mt-1 text-[22px] font-bold text-[var(--color-text-primary)]">
            {data.totals.projectCount}
          </div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase text-[var(--color-text-dim)]">Markets</div>
          <div className="mt-1 text-[22px] font-bold text-[var(--color-text-primary)]">
            {data.totals.marketCount}
          </div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase text-[var(--color-text-dim)]">Borrowed</div>
          <div className="mt-1 text-[22px] font-bold text-[var(--color-text-primary)]">
            {formatUsd(data.totals.borrowedUsd)}
          </div>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
        <span>{formatUpdatedAt(data.updatedAt)}</span>
        <span className="rounded-full bg-[rgba(0,232,123,0.08)] px-2 py-1 font-semibold text-[var(--color-positive)]">
          DefiLlama {data.sourceStatus.defiLlama}
        </span>
        <span className="rounded-full bg-[rgba(0,232,123,0.08)] px-2 py-1 font-semibold text-[var(--color-positive)]">
          Merkl {data.sourceStatus.merkl}
        </span>
      </div>

      <section className="mb-4 grid gap-3 md:grid-cols-[1fr_160px_170px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search asset, protocol, or market"
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-primary)]"
        />
        <select
          value={asset}
          onChange={(event) => setAsset(event.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-3 text-[13px] text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent-primary)]"
        >
          {assets.map((value) => (
            <option key={value} value={value}>
              {value === "All" ? "All Assets" : value}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-3 text-[13px] text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent-primary)]"
        >
          {categories.map((value) => (
            <option key={value} value={value}>
              {value === "All" ? "All Categories" : value}
            </option>
          ))}
        </select>
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["All", "LEND", "BORROW"] as ActionFilter[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setAction(value)}
            className={`rounded-[var(--radius-md)] border px-3 py-2 text-[12px] font-semibold transition-colors ${
              action === value
                ? "border-[var(--color-accent-primary)] bg-[rgba(0,232,123,0.1)] text-[var(--color-positive)]"
                : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {value === "All" ? "All" : value === "LEND" ? "Lend" : "Borrow"}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:hidden">
        {[
          ["deposits", "Deposits"],
          ["liquidity", "Liquidity"],
          ["apy", "APY"],
          ["utilization", "Utilization"],
        ].map(([field, label]) => {
          const active = sortField === field;
          return (
            <button
              key={field}
              type="button"
              aria-label={`Sort ${label}`}
              onClick={() => handleSort(field as SortField)}
              className={`flex items-center justify-between rounded-[var(--radius-md)] border px-3 py-2 text-[12px] font-semibold transition-colors ${
                active
                  ? "border-[var(--color-accent-primary)] bg-[rgba(0,232,123,0.08)] text-[var(--color-positive)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <span>{label}</span>
              <span>{active && sortDirection === "asc" ? "^" : "v"}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-2 text-[11px] text-[var(--color-text-dim)]">
        Showing {filteredMarkets.length} Monad markets. Protocol context from DefiLlama, live opportunities from Merkl.
      </div>

      {filteredMarkets.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-10 text-center">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            No markets match those filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setAsset("All");
              setCategory("All");
              setAction("All");
            }}
            className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {filteredMarkets.slice(0, 90).map((market) => (
              <MarketCard key={market.id} market={market} onDetails={setSelectedMarket} />
            ))}
          </div>

          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] table-fixed border-collapse">
              <colgroup>
                <col className="w-[280px]" />
                <col className="w-[160px]" />
                <col className="w-[140px]" />
                <col className="w-[140px]" />
                <col className="w-[110px]" />
                <col className="w-[120px]" />
                <col className="w-[90px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[11px] uppercase">
                  <th className="sticky left-0 z-20 bg-[#0A0E17] px-4 py-3 text-[var(--color-text-dim)] shadow-[12px_0_18px_rgba(10,14,23,0.65)]">
                    Asset
                  </th>
                  <th className="px-4 py-3 text-[var(--color-text-dim)]">Protocol</th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader
                      label="Deposits"
                      field="deposits"
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader
                      label="Liquidity"
                      field="liquidity"
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader
                      label="APY"
                      field="apy"
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader
                      label="Utilization"
                      field="utilization"
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-right text-[var(--color-text-dim)]">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredMarkets.slice(0, 90).map((market) => (
                  <MarketRow
                    key={market.id}
                    market={market}
                    onDetails={setSelectedMarket}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <MarketDetailsDrawer market={selectedMarket} onClose={() => setSelectedMarket(null)} />
    </div>
  );
}
