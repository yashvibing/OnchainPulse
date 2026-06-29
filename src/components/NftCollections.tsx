"use client";

import { useEffect, useMemo, useState } from "react";
import type { NftCollection } from "@/services/nftCollections";

type SortKey = "volume1d" | "floorPrice" | "floorChange1dPct" | "topOffer" | "sales1d" | "totalNfts" | "uniqueOwners";
type SortDirection = "asc" | "desc";

const SORT_LABELS: Record<SortKey, string> = {
  volume1d: "1D volume",
  floorPrice: "Floor",
  floorChange1dPct: "1D change",
  topOffer: "Top offer",
  sales1d: "1D sales",
  totalNfts: "Total NFTs",
  uniqueOwners: "Owners",
};

function formatNumber(value?: number, maximumFractionDigits = 0) {
  if (typeof value !== "number") return "-";
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function formatCompactNumber(value?: number, maximumFractionDigits = 1) {
  if (typeof value !== "number") return "-";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(maximumFractionDigits)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(maximumFractionDigits)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(maximumFractionDigits)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function formatMon(value?: number, currency = "MON") {
  if (typeof value !== "number") return "-";
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: digits })} ${currency}`;
}

function formatPercent(value?: number) {
  if (typeof value !== "number") return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function shortAddress(address?: string) {
  if (!address) return "-";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatRelativeTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function sortValue(collection: NftCollection, key: SortKey) {
  return collection[key] || 0;
}

function CollectionLogo({ collection }: { collection: NftCollection }) {
  const [failed, setFailed] = useState(false);
  const initials = collection.name
    .split(/\s+/u)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(0,245,204,0.09)] text-[12px] font-black text-[var(--color-accent-primary)]">
      {collection.imageUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={collection.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials || "NFT"
      )}
    </div>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4">
      <div className="label-caps text-[var(--color-text-dim)]">{label}</div>
      <div className="mt-2 text-[24px] font-black text-[var(--color-text-primary)]">{value}</div>
      {helper && <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">{helper}</div>}
    </div>
  );
}

export function NftCollections() {
  const [collections, setCollections] = useState<NftCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("volume1d");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [copiedAddress, setCopiedAddress] = useState("");

  async function loadCollections() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/nft-collections");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load NFT collections.");
      setCollections(Array.isArray(data.data) ? data.data : []);
      setUpdatedAt(Number(data.meta?.fetchedAt || Date.now()));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Could not load NFT collections.";
      setError(
        message.includes("OpenSea API key")
          ? "NFT market data is not enabled in this environment."
          : message
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCollections();
  }, []);

  const filteredCollections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? collections.filter((collection) =>
          [
            collection.name,
            collection.slug,
            collection.contractAddress || "",
            collection.marketplaceUrl,
          ].some((value) => value.toLowerCase().includes(normalizedQuery))
        )
      : collections;

    return [...filtered].sort((a, b) => {
      const delta = sortValue(a, sortKey) - sortValue(b, sortKey);
      return sortDirection === "asc" ? delta : -delta;
    });
  }, [collections, query, sortDirection, sortKey]);

  const summary = useMemo(() => {
    const totalVolume = collections.reduce((sum, collection) => sum + (collection.volume1d || 0), 0);
    const totalSales = collections.reduce((sum, collection) => sum + (collection.sales1d || 0), 0);
    const mostActive = [...collections].sort((a, b) => (b.sales1d || 0) - (a.sales1d || 0))[0];
    const highestFloor = [...collections].sort((a, b) => (b.floorPrice || 0) - (a.floorPrice || 0))[0];

    return {
      totalVolume,
      totalSales,
      mostActive,
      highestFloor,
    };
  }, [collections]);

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(nextKey);
    setSortDirection("desc");
  }

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

  async function copyContract(address?: string) {
    if (!address) return;
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
      window.setTimeout(() => {
        setCopiedAddress((current) => (current === address ? "" : current));
      }, 1600);
    } catch {
      setCopiedAddress("");
    }
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard
          label="Tracked collections"
          value={formatNumber(collections.length)}
          helper="OpenSea Monad data"
        />
        <StatCard
          label="1D NFT volume"
          value={formatMon(summary.totalVolume)}
          helper="Across displayed collections"
        />
        <StatCard
          label="1D sales"
          value={formatCompactNumber(summary.totalSales, 0)}
          helper={summary.mostActive ? `Most active: ${summary.mostActive.name}` : undefined}
        />
        <StatCard
          label="Highest floor"
          value={formatMon(summary.highestFloor?.floorPrice, summary.highestFloor?.floorCurrency)}
          helper={summary.highestFloor?.name}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="block">
          <span className="label-caps text-[var(--color-text-dim)]">Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Collection, slug, or contract"
            className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-4 py-3 text-[14px] font-semibold text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-primary)]"
          />
        </label>

        <div className="flex flex-wrap gap-2 md:justify-end">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleSort(key)}
              className={`rounded-[var(--radius-md)] border px-3 py-2 text-[12px] font-bold ${
                sortKey === key
                  ? "border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
              }`}
            >
              {SORT_LABELS[key]} {sortKey === key ? (sortDirection === "asc" ? "up" : "down") : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-[var(--color-text-muted)]">
        <span>
          Showing {filteredCollections.length} NFT collections.
          {updatedAt
            ? ` Updated ${new Date(updatedAt).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}.`
            : ""}
        </span>
        <button
          type="button"
          onClick={loadCollections}
          disabled={loading}
          className="min-h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[12px] font-bold text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[rgba(255,214,76,0.45)] bg-[rgba(255,214,76,0.08)] px-4 py-3 text-[13px] text-[var(--color-warning)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]"
            />
          ))}
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-8 text-[14px] text-[var(--color-text-muted)]">
          {error ? "NFT market data is intentionally unavailable here." : "No matching NFT collections found."}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredCollections.map((collection) => {
            const positive =
              typeof collection.floorChange1dPct === "number" && collection.floorChange1dPct >= 0;
            const isCopied = copiedAddress === collection.contractAddress;

            return (
              <article
                key={collection.id}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4"
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(260px,1.3fr)_repeat(8,minmax(84px,0.45fr))_auto] xl:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <CollectionLogo collection={collection} />
                    <div className="min-w-0">
                      <h3 className="truncate text-[18px] font-bold text-[var(--color-text-primary)]">
                        {collection.name}
                      </h3>
                      <div className="mt-1 truncate text-[12px] text-[var(--color-text-muted)]">
                        {collection.slug}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyContract(collection.contractAddress)}
                        disabled={!collection.contractAddress}
                        className="mt-2 inline-flex max-w-full items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-accent-primary)] disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label={`Copy ${collection.name} contract address`}
                      >
                        <span className="truncate">{shortAddress(collection.contractAddress)}</span>
                        <span className="font-sans text-[9px] uppercase">
                          {isCopied ? "Copied" : "Copy"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="label-caps text-[var(--color-text-dim)]">Floor</div>
                    <div className="mt-1 text-[15px] font-bold text-[var(--color-text-primary)]">
                      {formatMon(collection.floorPrice, collection.floorCurrency)}
                    </div>
                  </div>

                  <div>
                    <div className="label-caps text-[var(--color-text-dim)]">1D change</div>
                    <div className={`mt-1 text-[15px] font-bold ${positive ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
                      {formatPercent(collection.floorChange1dPct)}
                    </div>
                  </div>

                  <div>
                    <div className="label-caps text-[var(--color-text-dim)]">Top offer</div>
                    <div className="mt-1 text-[15px] font-bold text-[var(--color-text-primary)]">
                      {formatMon(collection.topOffer, collection.topOfferCurrency)}
                    </div>
                  </div>

                  <div>
                    <div className="label-caps text-[var(--color-text-dim)]">1D volume</div>
                    <div className="mt-1 text-[15px] font-bold text-[var(--color-text-primary)]">
                      {formatMon(collection.volume1d, collection.volumeCurrency)}
                    </div>
                  </div>

                  <div>
                    <div className="label-caps text-[var(--color-text-dim)]">1D sales</div>
                    <div className="mt-1 text-[15px] font-bold text-[var(--color-text-primary)]">
                      {formatNumber(collection.sales1d)}
                    </div>
                  </div>

                  <div>
                    <div className="label-caps text-[var(--color-text-dim)]">Total NFTs</div>
                    <div className="mt-1 text-[15px] font-bold text-[var(--color-text-primary)]">
                      {formatCompactNumber(collection.totalNfts)}
                    </div>
                  </div>

                  <div>
                    <div className="label-caps text-[var(--color-text-dim)]">Owners</div>
                    <div className="mt-1 text-[15px] font-bold text-[var(--color-text-primary)]">
                      {formatCompactNumber(collection.uniqueOwners)}
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                      Ratio {formatPercent(collection.ownerRatioPct)}
                    </div>
                  </div>

                  <div>
                    <div className="label-caps text-[var(--color-text-dim)]">Listed</div>
                    <div className="mt-1 text-[15px] font-bold text-[var(--color-text-primary)]">
                      {formatPercent(collection.listedPct)}
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                      Last sale {formatRelativeTime(collection.lastSaleAt)}
                    </div>
                  </div>

                  <a
                    href={collection.marketplaceUrl}
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
