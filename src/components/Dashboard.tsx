"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { usePortfolio } from "@/hooks/usePortfolio";
import { Header } from "@/components/Header";
import { AddressInput } from "@/components/AddressInput";
import { StatCards } from "@/components/StatCards";
import { TabBar } from "@/components/TabBar";
import { TokenTable } from "@/components/TokenTable";
import { StakingCards } from "@/components/StakingCards";
import { VaultCards } from "@/components/VaultCards";
import { LendingCards } from "@/components/LendingCards";
import { LiquidityCards } from "@/components/LiquidityCards";
import { SkeletonStatCards, SkeletonCards } from "@/components/EmptyState";
import { PortfolioSparkline } from "@/components/Sparkline";
import { shortenAddress, isValidEvmAddress } from "@/lib/format";
import {
  loadSavedAddresses,
  removeSavedAddress,
  saveAddress,
  type SavedAddress,
} from "@/lib/savedAddresses";

const PORTFOLIO_TABS = [
  { key: "overview", label: "Overview", icon: "◎" },
  { key: "tokens", label: "Tokens", icon: "◈" },
  { key: "staking", label: "Staking", icon: "⬡" },
  { key: "liquidity", label: "Liquidity", icon: "◇" },
  { key: "lending", label: "Lending", icon: "⊞" },
  { key: "yield", label: "Vaults", icon: "⬢" },
] as const;

type PortfolioTabKey = (typeof PORTFOLIO_TABS)[number]["key"];

export function Dashboard() {
  return (
    <Suspense>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PortfolioTabKey>("overview");
  const [tabFade, setTabFade] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [loadingDemoWallet, setLoadingDemoWallet] = useState(false);

  useEffect(() => {
    setSavedAddresses(loadSavedAddresses());
  }, []);

  useEffect(() => {
    const urlAddr = searchParams.get("address");
    if (urlAddr && isValidEvmAddress(urlAddr) && !address) {
      setAddress(urlAddr);
      setShowPortfolio(true);
      setSavedAddresses(saveAddress(urlAddr));
    }
  }, [searchParams, address]);

  const portfolio = usePortfolio(address);
  useEffect(() => {
    if (!portfolio.isLoading) setLoadingDemoWallet(false);
  }, [portfolio.isLoading]);

  function handleSearch(addr: string, source?: "manual" | "demo") {
    setAddress(addr);
    setShowPortfolio(true);
    setLoadingDemoWallet(source === "demo");
    setActiveTab("overview");
    setSavedAddresses(saveAddress(addr));
    router.replace(`?address=${addr}`, { scroll: false });
  }

  function handleRemoveSavedAddress(addr: string) {
    setSavedAddresses(removeSavedAddress(addr));
  }

  const handleTabChange = useCallback((key: string) => {
    setTabFade(true);
    setTimeout(() => {
      setActiveTab(key as PortfolioTabKey);
      setTabFade(false);
    }, 120);
  }, []);

  function handleExportCsv() {
    if (!address || portfolio.isLoading || portfolio.isError) return;

    try {
      const csv = buildPortfolioCsv(address, portfolio);
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filename = `onchain-pulse-${shortenAddress(address).replace("...", "-")}.csv`;

      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      setCopyFeedback(`CSV download started: ${filename}`);
    } catch {
      setCopyFeedback("CSV download could not start. Try another browser.");
    }
    setTimeout(() => setCopyFeedback(null), 2000);
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />

      <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-10 md:px-6">


        {/* ══════ PORTFOLIO SECTION ══════ */}
        {!showPortfolio && address && (
          <div className="text-center">
            <button
              onClick={() => setShowPortfolio(true)}
              className="text-[13px] text-[var(--color-accent-primary)] underline hover:opacity-80"
            >
              View portfolio for {shortenAddress(address)}
            </button>
          </div>
        )}

        {!address && (
          <div className="mt-10">
            <div className="mx-auto max-w-[860px]">
              <div className="label-caps text-center text-[var(--color-accent-primary)]">
                Portfolio tracker
              </div>
              <h1 className="mx-auto mt-3 max-w-[760px] text-center text-[40px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] md:text-[56px]">
                Portfolio Tracker
              </h1>
              <p className="mx-auto mb-6 mt-3 max-w-[720px] text-center text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
                Paste a public wallet to view holdings, positions, and rate matches.
              </p>

              <div id="track-wallet" className="mx-auto mt-8 max-w-[760px] scroll-mt-24">
                <AddressInput onSubmit={handleSearch} initialAddress={address} />
              </div>
              <SavedAddressBar
                addresses={savedAddresses}
                activeAddress={address}
                onSelect={handleSearch}
                onRemove={handleRemoveSavedAddress}
              />
            </div>
          </div>
        )}

        {address && showPortfolio && (
          <section className="mt-6 border-t border-[var(--color-border)] pt-6">
            {/* Wallet badge */}
            <div className="mb-4 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] lg:items-start">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5">
                <div className="h-2 w-2 rounded-full bg-[var(--color-positive)] animate-pulse" />
                <span className="font-mono text-[12px] text-[var(--color-text-secondary)]">
                  {shortenAddress(address)}
                </span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(address).then(() => {
                    setCopyFeedback("Copied!");
                    setTimeout(() => setCopyFeedback(null), 2000);
                  });
                }}
                className="min-h-10 rounded-[var(--radius-md)] px-3 text-[11px] text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-text-muted)]"
              >
                Copy
              </button>
              <button
                onClick={handleExportCsv}
                disabled={portfolio.isLoading || portfolio.isError}
                className="min-h-10 rounded-[var(--radius-md)] px-3 text-[11px] text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-text-muted)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Export CSV
              </button>
              {copyFeedback && (
                <span className="animate-fade-up text-[11px] font-medium text-[var(--color-positive)]">
                  {copyFeedback}
                </span>
              )}
              </div>
              <div className="min-w-0">
                <AddressInput onSubmit={handleSearch} initialAddress={address} />
              </div>
            </div>
            <SavedAddressBar
              addresses={savedAddresses}
              activeAddress={address}
              onSelect={handleSearch}
              onRemove={handleRemoveSavedAddress}
            />

            {/* Skeleton loading */}
            {portfolio.isLoading && (
              <div className="animate-fade-up">
                <div className="mb-4 rounded-[var(--radius-md)] border border-[rgba(0,245,204,0.28)] bg-[rgba(0,245,204,0.06)] px-4 py-3 text-[13px] text-[var(--color-text-secondary)]">
                  {loadingDemoWallet
                    ? "Loading demo wallet with tokens, staking, lending, liquidity, and vault sections..."
                    : "Loading wallet positions across portfolio sections..."}
                </div>
                <SkeletonStatCards />
                <SkeletonCards count={3} />
              </div>
            )}

            {/* Error */}
            {portfolio.isError && (
              <div className="mt-8 text-center">
                <p className="text-[var(--color-negative)] text-sm">
                  Failed to load portfolio. Check your connection.
                </p>
              </div>
            )}

            {/* Portfolio loaded */}
            {!portfolio.isLoading && !portfolio.isError && (
              <>
                <StatCards
                  totalValue={portfolio.totalValue}
                  dailyYield={portfolio.dailyYield}
                  positionCount={portfolio.positionCount}
                  protocolCount={portfolio.protocolCount}
                />

                <PortfolioSparkline
                  holdings={new Map(
                    portfolio.tokens.map((t) => [t.token.symbol, t.valueUsd])
                  )}
                />

                <RefreshBar
                  onRefresh={portfolio.refetch}
                  updatedAt={portfolio.updatedAt}
                  cacheStatus={portfolio.cacheStatus}
                />

                {/* Desktop tabs */}
                <div className="hidden md:block">
                  <TabBar tabs={PORTFOLIO_TABS} active={activeTab} onChange={handleTabChange} />
                </div>

                {/* Tab content */}
                <div className="transition-opacity duration-150" style={{ opacity: tabFade ? 0 : 1 }}>
                  {activeTab === "overview" && (
                    <div className="space-y-6">
                      {portfolio.tokens.length > 0 && (
                        <section className="animate-fade-up" style={{ animationDelay: "0ms" }}>
                          <SectionTitle icon="◈" title="Top Holdings" />
                          <TokenTable tokens={portfolio.tokens.slice(0, 5)} compact />
                        </section>
                      )}
                      {portfolio.staking.length > 0 && (
                        <section className="animate-fade-up" style={{ animationDelay: "60ms" }}>
                          <SectionTitle icon="⬡" title="Active Staking" />
                          <StakingCards positions={portfolio.staking} />
                        </section>
                      )}
                      {portfolio.liquidity.length > 0 && (
                        <section className="animate-fade-up" style={{ animationDelay: "120ms" }}>
                          <SectionTitle icon="◇" title="Liquidity Positions" />
                          <LiquidityCards positions={portfolio.liquidity} />
                        </section>
                      )}
                      {portfolio.lending.length > 0 && (
                        <section className="animate-fade-up" style={{ animationDelay: "180ms" }}>
                          <SectionTitle icon="⊞" title="Lending & Borrowing" />
                          <LendingCards positions={portfolio.lending} />
                        </section>
                      )}
                      {portfolio.vaults.length > 0 && (
                        <section className="animate-fade-up" style={{ animationDelay: "240ms" }}>
                          <SectionTitle icon="⬢" title="Vault Positions" />
                          <VaultCards positions={portfolio.vaults} />
                        </section>
                      )}
                    </div>
                  )}

                  {activeTab === "tokens" && (
                    <div className="animate-fade-up">
                      <SectionTitle icon="◈" title="Token Holdings" count={portfolio.tokens.length} />
                      <TokenTable tokens={portfolio.tokens} />
                    </div>
                  )}

                  {activeTab === "staking" && (
                    <div className="animate-fade-up">
                      <SectionTitle icon="⬡" title="Staking Positions" count={portfolio.staking.length} />
                      {portfolio.staking.length > 0 ? <StakingCards positions={portfolio.staking} /> : <NoPositions label="staking positions" />}
                    </div>
                  )}

                  {activeTab === "liquidity" && (
                    <div className="animate-fade-up">
                      <SectionTitle icon="◇" title="Liquidity Positions" count={portfolio.liquidity.length} />
                      {portfolio.liquidity.length > 0 ? <LiquidityCards positions={portfolio.liquidity} /> : <NoPositions label="liquidity positions" />}
                    </div>
                  )}

                  {activeTab === "lending" && (
                    <div className="animate-fade-up">
                      <SectionTitle icon="⊞" title="Lending & Borrowing" count={portfolio.lending.length} />
                      {portfolio.lending.length > 0 ? <LendingCards positions={portfolio.lending} /> : <NoPositions label="lending positions" />}
                    </div>
                  )}

                  {activeTab === "yield" && (
                    <div className="animate-fade-up">
                      <SectionTitle icon="⬢" title="Vault Positions" count={portfolio.vaults.length} />
                      {portfolio.vaults.length > 0 ? <VaultCards positions={portfolio.vaults} /> : <NoPositions label="vault positions" />}
                    </div>
                  )}

                </div>

                <footer className="mt-12 text-center text-[11px] leading-relaxed text-[var(--color-text-dim)]">
                  <p>Onchain Pulse is an independent, unofficial interface. It is not associated with, endorsed by, or affiliated with Monad Foundation.</p>
                  <p className="mt-1">Data from third-party sources including DefiLlama and Merkl.</p>
                </footer>
              </>
            )}
          </section>
        )}

        {/* Footer when no portfolio */}
        {!showPortfolio && (
          <footer className="mt-16 text-center text-[11px] leading-relaxed text-[var(--color-text-dim)]">
            <p>Onchain Pulse is an independent, unofficial interface. It is not associated with, endorsed by, or affiliated with Monad Foundation.</p>
            <p className="mt-1">Data from third-party sources including DefiLlama and Merkl.</p>
          </footer>
        )}
      </main>

      {/* Mobile bottom nav — only when portfolio is visible */}
      {address && showPortfolio && !portfolio.isLoading && !portfolio.isError && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] backdrop-blur-lg md:hidden">
          <div className="mx-auto flex max-w-[1000px] items-center justify-around px-2 py-1.5">
            {PORTFOLIO_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-colors ${
                  activeTab === tab.key
                    ? "text-[var(--color-accent-primary)]"
                    : "text-[var(--color-text-dim)]"
                }`}
              >
                <span className="text-[16px]">{tab.icon}</span>
                <span className="text-[9px] font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

// ─── CSV export ───

type PortfolioData = ReturnType<typeof usePortfolio>;

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}

function buildPortfolioCsv(address: string, portfolio: PortfolioData) {
  const rows: unknown[][] = [
    ["section", "type", "protocol", "asset", "balance", "value_usd", "rate_percent", "details"],
    ["summary", "wallet", "", address, "", "", "", `generated_at=${new Date().toISOString()}`],
    ["summary", "total_value", "", "", "", portfolio.totalValue, "", ""],
    ["summary", "estimated_daily_amount", "", "", "", portfolio.dailyYield, "", ""],
    ["summary", "positions", "", "", portfolio.positionCount, "", "", `protocols=${portfolio.protocolCount}`],
  ];

  for (const holding of portfolio.tokens) {
    rows.push([
      "tokens",
      holding.token.category,
      "",
      holding.token.symbol,
      holding.formatted,
      holding.valueUsd,
      "",
      `name=${holding.token.name}; price_usd=${holding.priceUsd}; change_24h=${holding.change24h ?? ""}`,
    ]);
  }

  for (const position of portfolio.staking) {
    rows.push([
      "staking",
      "liquid_staking",
      position.protocol,
      position.lstSymbol,
      position.lstBalance,
      position.stakedValueUsd,
      position.apy,
      `mon_equivalent=${position.monEquivalent}; exchange_rate=${position.exchangeRate}`,
    ]);
  }

  for (const position of portfolio.lending) {
    rows.push([
      "lending",
      position.type,
      position.protocol,
      position.asset,
      position.balance,
      position.valueUsd,
      position.apy,
      "",
    ]);
  }

  for (const position of portfolio.liquidity) {
    if (position.kind === "uniswap-v3") {
      rows.push([
        "liquidity",
        "uniswap_v3",
        position.protocol,
        `${position.token0Symbol}/${position.token1Symbol}`,
        `${position.amount0} ${position.token0Symbol}; ${position.amount1} ${position.token1Symbol}`,
        position.valueUsd,
        "",
        `token_id=${position.tokenId}; fee=${position.feeLabel}; in_range=${position.inRange}; fees_usd=${position.feesUsd}`,
      ]);
      continue;
    }

    rows.push([
      "liquidity",
      "curve",
      position.protocol,
      position.poolLabel,
      position.lpBalance,
      position.valueUsd,
      "",
      `pool=${position.poolAddress}; share=${position.sharePercent}`,
    ]);
  }

  for (const position of portfolio.vaults) {
    rows.push([
      "vaults",
      "vault",
      position.vaultName,
      position.underlyingSymbol,
      position.underlyingBalance,
      position.valueUsd,
      position.apy,
      `shares=${position.sharesBalance}`,
    ]);
  }

  return rows.map(csvRow).join("\n");
}

// ─── Sub-components ───

function SectionTitle({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="text-lg">{icon}</span>
      <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]">{title}</h2>
      {count !== undefined && (
        <span className="rounded-full bg-[rgba(0,245,204,0.1)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-positive)]">{count}</span>
      )}
    </div>
  );
}

function NoPositions({ label }: { label: string }) {
  return <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">No {label} found for this wallet.</p>;
}

function SavedAddressBar({
  addresses,
  activeAddress,
  onSelect,
  onRemove,
}: {
  addresses: SavedAddress[];
  activeAddress: string | null;
  onSelect: (address: string) => void;
  onRemove: (address: string) => void;
}) {
  if (addresses.length === 0) return null;

  return (
    <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-3">
      <div className="mb-1 text-[10px] font-semibold uppercase text-[var(--color-accent-primary)]">
        Watchlist
      </div>
      <div className="mb-2 text-[11px] text-[var(--color-text-dim)]">
        Saved in this browser. No login required.
      </div>
      <div className="flex flex-wrap gap-2">
        {addresses.map((item) => {
          const active = activeAddress?.toLowerCase() === item.address.toLowerCase();
          return (
            <div
              key={item.address}
              className={`flex min-h-10 items-center gap-1 rounded-[var(--radius-md)] border px-2 py-1.5 text-[11px] ${
                active
                  ? "border-[var(--color-accent-primary)] bg-[rgba(0,245,204,0.08)] text-[var(--color-positive)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(item.address)}
                className="min-h-8 px-1 font-mono hover:text-[var(--color-text-primary)]"
              >
                {item.label}
              </button>
              <button
                type="button"
                aria-label={`Remove ${item.label}`}
                onClick={() => onRemove(item.address)}
                className="ml-1 min-h-8 min-w-8 rounded-[var(--radius-sm)] text-[var(--color-text-dim)] hover:text-[var(--color-negative)]"
              >
                x
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RefreshBar({
  onRefresh,
  updatedAt,
  cacheStatus,
}: {
  onRefresh: () => void;
  updatedAt?: number;
  cacheStatus?: "hit" | "miss" | "stale";
}) {
  const [lastUpdated, setLastUpdated] = useState<number>(updatedAt || Date.now());
  const [ago, setAgo] = useState("just now");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (updatedAt) setLastUpdated(updatedAt);
  }, [updatedAt]);

  useEffect(() => {
    function tick() {
      const diff = Math.floor((Date.now() - lastUpdated) / 1000);
      if (diff < 10) setAgo("just now");
      else if (diff < 60) setAgo(`${diff}s ago`);
      else setAgo(`${Math.floor(diff / 60)}m ago`);
    }
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  function handleRefresh() {
    setRefreshing(true);
    onRefresh();
    setLastUpdated(Date.now());
    setTimeout(() => setRefreshing(false), 1500);
  }

  return (
    <div className="mb-4 flex items-center gap-2 text-[11px] text-[var(--color-text-dim)]">
      <span>Updated {ago}</span>
      {cacheStatus === "stale" && (
        <>
          <span>·</span>
          <span>Using cached data</span>
        </>
      )}
      <span>·</span>
      <button onClick={handleRefresh} disabled={refreshing} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors disabled:opacity-50">
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
