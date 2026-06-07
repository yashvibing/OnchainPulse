"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TokenMarket } from "@/services/tokenMarkets";

type SortKey = "volume" | "change" | "liquidity" | "marketCap" | "fdv";
type SortDirection = "asc" | "desc";
type ChartRange = "24h" | "7d" | "30d";

interface ChartPoint {
  timestamp: number;
  value: number;
  volumeUsd?: number;
}

const SORT_LABELS: Record<SortKey, string> = {
  volume: "24 hr volume",
  change: "24 hr price change",
  liquidity: "Liquidity",
  marketCap: "Market cap",
  fdv: "FDV",
};

const CHART_RANGE_LABELS: Record<ChartRange, string> = {
  "24h": "24H",
  "7d": "7D",
  "30d": "30D",
};

const CHART_RANGE_DESCRIPTIONS: Record<ChartRange, string> = {
  "24h": "24 hour",
  "7d": "7 day",
  "30d": "30 day",
};

function formatCurrency(value?: number, maximumFractionDigits = 2) {
  if (typeof value !== "number") return "-";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value > 0 && value < 0.01) return `$${value.toFixed(6)}`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits })}`;
}

function formatPercent(value?: number) {
  if (typeof value !== "number") return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function sortValue(market: TokenMarket, key: SortKey) {
  if (key === "volume") return market.volume24hUsd || 0;
  if (key === "change") return market.priceChange24h || 0;
  if (key === "liquidity") return market.liquidityUsd || 0;
  if (key === "marketCap") return market.marketCapUsd || 0;
  return market.fdvUsd || 0;
}

function shortAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function hasChartablePool(market: TokenMarket) {
  return /^0x[a-f0-9]{40,64}$/iu.test(market.poolAddress || "");
}

function chartChange(points: ChartPoint[]) {
  if (points.length < 2) return undefined;
  const first = points[0]?.value;
  const last = points[points.length - 1]?.value;
  if (!first || !last) return undefined;
  return ((last - first) / first) * 100;
}

function buildLinePath(points: ChartPoint[], width: number, height: number, padding: number) {
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

async function fetchChart(
  market: TokenMarket,
  range: ChartRange,
  signal?: AbortSignal
): Promise<ChartPoint[]> {
  if (!hasChartablePool(market)) return [];
  const params = new URLSearchParams({
    pool: market.poolAddress,
    range,
    side: market.chartTokenSide || "base",
  });
  const response = await fetch(`/api/token-market-chart?${params.toString()}`, { signal });
  if (!response.ok) throw new Error("Chart unavailable");
  const data = await response.json();
  return Array.isArray(data.data) ? data.data : [];
}

function TokenIcon({ market }: { market: TokenMarket }) {
  const [failed, setFailed] = useState(false);
  const initials = market.tokenSymbol.slice(0, 2);

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--color-border)] bg-[rgba(0,245,204,0.09)] text-[11px] font-black text-[var(--color-accent-primary)]">
      {market.tokenImageUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={market.tokenImageUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}

function MiniTokenChart({ market, range }: { market: TokenMarket; range: ChartRange }) {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const controller = new AbortController();
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        setStatus("loading");
        fetchChart(market, range, controller.signal)
          .then((nextPoints) => {
            setPoints(nextPoints);
            setStatus(nextPoints.length >= 2 ? "ready" : "error");
          })
          .catch(() => setStatus("error"));
      },
      { rootMargin: "220px" }
    );

    observer.observe(node);
    return () => {
      controller.abort();
      observer.disconnect();
    };
  }, [market, range]);

  const change = chartChange(points);
  const isPositive = (change || 0) >= 0;
  const color = isPositive ? "var(--color-positive)" : "var(--color-negative)";
  const linePath = buildLinePath(points, 120, 36, 2);

  return (
    <div ref={containerRef} className="min-w-[116px]">
      <div className="label-caps text-[var(--color-text-dim)]">
        {CHART_RANGE_LABELS[range]} chart
      </div>
      <div className="mt-1 h-10">
        {status === "ready" ? (
          <svg viewBox="0 0 120 36" className="h-full w-full" preserveAspectRatio="none">
            <path d={linePath} fill="none" stroke={color} strokeWidth="2" />
          </svg>
        ) : status === "loading" || status === "idle" ? (
          <div className="h-full animate-pulse rounded-[var(--radius-sm)] bg-[rgba(255,255,255,0.04)]" />
        ) : (
          <div className="flex h-full items-center text-[11px] text-[var(--color-text-dim)]">
            No chart
          </div>
        )}
      </div>
    </div>
  );
}

function ExpandedTokenChart({ market, range }: { market: TokenMarket; range: ChartRange }) {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const gradientId = `token-chart-${market.id.replace(/[^a-z0-9]+/giu, "-")}-${range}`;

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetchChart(market, range, controller.signal)
      .then((nextPoints) => {
        setPoints(nextPoints);
        setStatus(nextPoints.length >= 2 ? "ready" : "error");
      })
      .catch(() => setStatus("error"));

    return () => controller.abort();
  }, [market, range]);

  const change = chartChange(points);
  const isPositive = (change || 0) >= 0;
  const color = isPositive ? "var(--color-positive)" : "var(--color-negative)";
  const linePath = buildLinePath(points, 100, 44, 2);
  const areaPath = linePath ? `${linePath} L98,44 L2,44 Z` : "";
  const latestPoint = points[points.length - 1];

  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label-caps text-[var(--color-text-dim)]">
            {CHART_RANGE_DESCRIPTIONS[range]} chart
          </div>
          <div className="mt-1 text-[18px] font-bold text-[var(--color-text-primary)]">
            {market.tokenSymbol} trend
          </div>
        </div>
        <div className="text-right">
          <div className={`text-[18px] font-black ${isPositive ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
            {typeof change === "number" ? formatPercent(change) : "-"}
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)]">
            Latest {latestPoint ? formatCurrency(latestPoint.value, 6) : formatCurrency(market.priceUsd, 6)}
          </div>
        </div>
      </div>

      {status === "ready" ? (
        <svg viewBox="0 0 100 44" className="h-28 w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth="0.9" />
        </svg>
      ) : status === "loading" ? (
        <div className="h-28 animate-pulse rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.04)]" />
      ) : (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-6 text-[13px] text-[var(--color-text-muted)]">
          Chart is unavailable from the market data source right now.
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["24 hr volume", formatCurrency(market.volume24hUsd)],
          ["Liquidity", formatCurrency(market.liquidityUsd)],
          ["Market cap", formatCurrency(market.marketCapUsd)],
          ["FDV", formatCurrency(market.fdvUsd)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2">
            <div className="label-caps text-[var(--color-text-dim)]">{label}</div>
            <div className="mt-1 text-[14px] font-bold text-[var(--color-text-primary)]">
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TokenMarkets() {
  const [markets, setMarkets] = useState<TokenMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [chartRange, setChartRange] = useState<ChartRange>("24h");
  const [expandedMarketId, setExpandedMarketId] = useState("");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [copiedAddress, setCopiedAddress] = useState("");
  const [showFdv, setShowFdv] = useState(false);

  async function loadMarkets() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/token-markets");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load token markets.");
      setMarkets(Array.isArray(data.data) ? data.data : []);
      setUpdatedAt(Number(data.meta?.fetchedAt || Date.now()));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load token markets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMarkets();
  }, []);

  const filteredMarkets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? markets.filter((market) => {
          return [
            market.tokenSymbol,
            market.tokenName,
            market.dexLabel,
            market.poolName,
            market.tokenAddress,
          ].some((value) => value.toLowerCase().includes(normalizedQuery));
        })
      : markets;

    return [...filtered].sort((a, b) => {
      const delta = sortValue(a, sortKey) - sortValue(b, sortKey);
      return sortDirection === "asc" ? delta : -delta;
    });
  }, [markets, query, sortDirection, sortKey]);

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(nextKey);
    setSortDirection("desc");
  }

  function toggleFdv() {
    setShowFdv((current) => {
      const next = !current;
      if (!next && sortKey === "fdv") {
        setSortKey("volume");
        setSortDirection("desc");
      }
      return next;
    });
  }

  const activeSortLabel = `${SORT_LABELS[sortKey]} ${
    sortDirection === "asc" ? "low to high" : "high to low"
  }`;

  function copyWithFallback(address: string) {
    const textarea = document.createElement("textarea");
    textarea.value = address;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  async function copyContract(address: string) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(address);
        } catch {
          copyWithFallback(address);
        }
      } else {
        copyWithFallback(address);
      }
      setCopiedAddress(address);
      window.setTimeout(() => setCopiedAddress((current) => current === address ? "" : current), 1600);
    } catch {
      setCopiedAddress("");
    }
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="block">
          <span className="label-caps text-[var(--color-text-dim)]">Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Token, pool, exchange, or contract"
            className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-4 py-3 text-[14px] font-semibold text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-primary)]"
          />
        </label>

        <div className="flex flex-wrap gap-2 md:justify-end">
          {[
            ["volume", SORT_LABELS.volume],
            ["change", SORT_LABELS.change],
            ["liquidity", "Liquidity"],
            ["marketCap", "Market cap"],
            ...(showFdv ? [["fdv", "FDV"]] : []),
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleSort(key as SortKey)}
              aria-label={`Sort by ${label}${
                sortKey === key
                  ? sortDirection === "asc"
                    ? ", currently low to high"
                    : ", currently high to low"
                  : ""
              }`}
              className={`rounded-[var(--radius-md)] border px-3 py-2 text-[12px] font-bold ${
                sortKey === key
                  ? "border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
                }`}
            >
              {label} {sortKey === key ? (sortDirection === "asc" ? "↑" : "↓") : ""}
            </button>
          ))}
          <button
            type="button"
            onClick={toggleFdv}
            className={`rounded-[var(--radius-md)] border px-3 py-2 text-[12px] font-bold ${
              showFdv
                ? "border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]"
                : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
            }`}
          >
            {showFdv ? "Hide FDV" : "Show FDV"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-[var(--color-text-muted)]">
        <span>
          Showing {filteredMarkets.length} token markets sorted by {activeSortLabel}.
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-caps text-[var(--color-text-dim)]">Chart</span>
          {(Object.keys(CHART_RANGE_LABELS) as ChartRange[]).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setChartRange(range)}
              className={`rounded-[var(--radius-md)] border px-3 py-2 text-[12px] font-bold ${
                chartRange === range
                  ? "border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
              }`}
            >
              {CHART_RANGE_LABELS[range]}
            </button>
          ))}
          <button
            type="button"
            onClick={loadMarkets}
            disabled={loading}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[12px] font-bold text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {updatedAt && (
        <div className="text-[11px] text-[var(--color-text-dim)]">
          Market data updated {new Date(updatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.
        </div>
      )}

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[rgba(255,184,0,0.45)] bg-[rgba(255,184,0,0.08)] px-4 py-3 text-[13px] text-[var(--color-warning)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]" />
          ))}
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-8 text-[14px] text-[var(--color-text-muted)]">
          No matching token markets found.
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredMarkets.map((market) => {
            const positive = typeof market.priceChange24h === "number" && market.priceChange24h >= 0;
            const isCopied = copiedAddress === market.tokenAddress;
            const isExpanded = expandedMarketId === market.id;

            return (
              <article
                key={market.id}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4"
              >
                <div
                  className={`grid gap-4 lg:items-center ${
                    showFdv
                      ? "lg:grid-cols-[minmax(0,1.25fr)_repeat(6,minmax(82px,0.38fr))_minmax(116px,0.5fr)_auto_auto]"
                      : "lg:grid-cols-[minmax(0,1.25fr)_repeat(5,minmax(82px,0.38fr))_minmax(116px,0.5fr)_auto_auto]"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <TokenIcon market={market} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-[18px] font-bold text-[var(--color-text-primary)]">
                          {market.tokenSymbol}
                        </h3>
                        <span className="rounded-[var(--radius-sm)] bg-[rgba(0,245,204,0.1)] px-2 py-1 text-[9px] font-bold uppercase text-[var(--color-positive)]">
                          {market.dexLabel}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-[12px] text-[var(--color-text-muted)]">
                        {market.tokenName}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyContract(market.tokenAddress)}
                        className="mt-2 inline-flex max-w-full items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-accent-primary)]"
                        aria-label={`Copy ${market.tokenSymbol} contract address`}
                      >
                        <span className="truncate">{shortAddress(market.tokenAddress)}</span>
                        <span className="font-sans text-[9px] uppercase">
                          {isCopied ? "Copied" : "Copy"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="label-caps text-[var(--color-text-dim)]">Price</div>
                    <div className="mt-1 text-[15px] font-bold text-[var(--color-text-primary)]">
                      {formatCurrency(market.priceUsd, 6)}
                    </div>
                  </div>

                  <div>
                    <div className="label-caps text-[var(--color-text-dim)]">24 hr</div>
                    <div className={`mt-1 text-[15px] font-bold ${positive ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
                      {formatPercent(market.priceChange24h)}
                    </div>
                  </div>

                  <div>
                    <div className="label-caps text-[var(--color-text-dim)]">Volume</div>
                    <div className="mt-1 text-[15px] font-bold text-[var(--color-text-primary)]">
                      {formatCurrency(market.volume24hUsd)}
                    </div>
                  </div>

                  <div>
                    <div className="label-caps text-[var(--color-text-dim)]">Liquidity</div>
                    <div className="mt-1 text-[15px] font-bold text-[var(--color-text-primary)]">
                      {formatCurrency(market.liquidityUsd)}
                    </div>
                  </div>

                  <div>
                    <div className="label-caps text-[var(--color-text-dim)]">Market cap</div>
                    <div className="mt-1 text-[15px] font-bold text-[var(--color-text-primary)]">
                      {formatCurrency(market.marketCapUsd)}
                    </div>
                  </div>

                  {showFdv && (
                    <div>
                      <div className="label-caps text-[var(--color-text-dim)]">FDV</div>
                      <div className="mt-1 text-[15px] font-bold text-[var(--color-text-primary)]">
                        {formatCurrency(market.fdvUsd)}
                      </div>
                    </div>
                  )}

                  <MiniTokenChart market={market} range={chartRange} />

                  <button
                    type="button"
                    onClick={() => setExpandedMarketId((current) => current === market.id ? "" : market.id)}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-center text-[12px] font-bold text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-accent-primary)]"
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? "Hide chart" : "Chart"}
                  </button>

                  <a
                    href={market.poolUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-center text-[12px] font-bold text-[var(--color-accent-primary)] hover:border-[var(--color-border-hover)]"
                  >
                    Open
                  </a>
                </div>
                {isExpanded && <ExpandedTokenChart market={market} range={chartRange} />}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
