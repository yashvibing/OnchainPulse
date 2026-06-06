"use client";

import { useEffect, useMemo, useState } from "react";
import type { TokenMarket } from "@/services/tokenMarkets";

type SortKey = "volume" | "change" | "liquidity" | "marketCap" | "fdv";
type SortDirection = "asc" | "desc";

const SORT_LABELS: Record<SortKey, string> = {
  volume: "24 hr volume",
  change: "24 hr price change",
  liquidity: "Liquidity",
  marketCap: "Market cap",
  fdv: "FDV",
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

export function TokenMarkets() {
  const [markets, setMarkets] = useState<TokenMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [copiedAddress, setCopiedAddress] = useState("");

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
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
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
            ["fdv", "FDV"],
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
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--color-text-muted)]">
        <span>
          Showing {filteredMarkets.length} token markets sorted by {activeSortLabel}.
        </span>
        <button
          type="button"
          onClick={loadMarkets}
          disabled={loading}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[12px] font-bold text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
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

            return (
              <article
                key={market.id}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4"
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_repeat(6,minmax(86px,0.42fr))_auto] lg:items-center">
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
                        {market.tokenName} - {market.poolName}
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

                  <div>
                    <div className="label-caps text-[var(--color-text-dim)]">FDV</div>
                    <div className="mt-1 text-[15px] font-bold text-[var(--color-text-primary)]">
                      {formatCurrency(market.fdvUsd)}
                    </div>
                  </div>

                  <a
                    href={market.poolUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-center text-[12px] font-bold text-[var(--color-accent-primary)] hover:border-[var(--color-border-hover)]"
                  >
                    Open
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
