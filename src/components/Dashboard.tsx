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
import {
  EmptyState,
  LoadingSpinner,
  SkeletonStatCards,
  SkeletonCards,
} from "@/components/EmptyState";
import { PortfolioSparkline } from "@/components/Sparkline";
import { shortenAddress, isValidEvmAddress } from "@/lib/format";

const TABS = [
  { key: "overview", label: "Overview", icon: "◎" },
  { key: "tokens", label: "Tokens", icon: "◈" },
  { key: "staking", label: "Staking", icon: "⬡" },
  { key: "liquidity", label: "Liquidity", icon: "◇" },
  { key: "lending", label: "Lending", icon: "⊞" },
  { key: "yield", label: "Yield", icon: "⬢" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

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
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [tabFade, setTabFade] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Read address from URL on first load
  useEffect(() => {
    const urlAddr = searchParams.get("address");
    if (urlAddr && isValidEvmAddress(urlAddr) && !address) {
      setAddress(urlAddr);
    }
  }, [searchParams, address]);

  const portfolio = usePortfolio(address);

  function handleSearch(addr: string) {
    setAddress(addr);
    setActiveTab("overview");
    router.replace(`?address=${addr}`, { scroll: false });
  }

  const handleTabChange = useCallback((key: string) => {
    setTabFade(true);
    setTimeout(() => {
      setActiveTab(key as TabKey);
      setTabFade(false);
    }, 120);
  }, []);

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />

      <main className="mx-auto max-w-[920px] px-5 pb-16 pt-6">
        <AddressInput onSubmit={handleSearch} initialAddress={address} />

        {/* Wallet address badge */}
        {address && (
          <div className="mb-4 flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-[var(--color-positive)] animate-pulse" />
              <span className="font-mono text-[12px] text-[var(--color-text-secondary)]">
                {shortenAddress(address)}
              </span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(address).then(() => {
                  setCopyFeedback("Copied address!");
                  setTimeout(() => setCopyFeedback(null), 2000);
                });
              }}
              className="text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)] transition-colors"
            >
              Copy
            </button>
            <button
              onClick={() => {
                // Encode stats as: totalValue.positions.protocols.dailyYield
                const v = [
                  Math.round(portfolio.totalValue),
                  portfolio.positionCount,
                  portfolio.protocolCount,
                  Math.round(portfolio.dailyYield * 100) / 100,
                ].join("_");
                const url = `${window.location.origin}?address=${address}&v=${v}`;
                navigator.clipboard.writeText(url).then(() => {
                  setCopyFeedback("Link copied!");
                  setTimeout(() => setCopyFeedback(null), 2000);
                });
              }}
              className="text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)] transition-colors"
            >
              Share
            </button>
            {copyFeedback && (
              <span className="animate-fade-up text-[11px] font-medium text-[var(--color-positive)]">
                {copyFeedback}
              </span>
            )}
          </div>
        )}

        {/* Skeleton loading */}
        {portfolio.isLoading && address && (
          <div className="animate-fade-up">
            <SkeletonStatCards />
            <SkeletonCards count={3} />
          </div>
        )}

        {/* Spinner fallback for initial load */}
        {portfolio.isLoading && !address && <LoadingSpinner />}

        {/* Empty — no address entered yet */}
        {!address && !portfolio.isLoading && <EmptyState />}

        {/* Error */}
        {portfolio.isError && (
          <div className="mt-12 text-center">
            <p className="text-[var(--color-negative)] text-sm">
              Failed to load portfolio data. Check your RPC connection and try
              again.
            </p>
          </div>
        )}

        {/* Portfolio loaded */}
        {address && !portfolio.isLoading && !portfolio.isError && (
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

            <RefreshBar onRefresh={portfolio.refetch} />

            {/* Desktop tab bar — hidden on mobile */}
            <div className="hidden md:block">
              <TabBar
                tabs={TABS}
                active={activeTab}
                onChange={handleTabChange}
              />
            </div>

            {/* Tab content with fade transition */}
            <div
              className="transition-opacity duration-150"
              style={{ opacity: tabFade ? 0 : 1 }}
            >
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
                      <SectionTitle icon="⬢" title="Yield Vaults" />
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
                  <SectionTitle icon="⬢" title="Yield Vaults" count={portfolio.vaults.length} />
                  {portfolio.vaults.length > 0 ? <VaultCards positions={portfolio.vaults} /> : <NoPositions label="yield vault positions" />}
                </div>
              )}
            </div>

            <footer className="mt-12 text-center text-[11px] leading-relaxed text-[var(--color-text-dim)]">
              <p>Onchain Pulse is a community-built tool. Not affiliated with Monad Foundation.</p>
              <p className="mt-1">Data powered by Monad RPC · DefiLlama</p>
            </footer>
          </>
        )}
      </main>

      {/* Mobile bottom navigation */}
      {address && !portfolio.isLoading && !portfolio.isError && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] backdrop-blur-lg md:hidden">
          <div className="mx-auto flex max-w-[920px] items-center justify-around px-2 py-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-colors ${
                  activeTab === tab.key
                    ? "text-[var(--color-accent-violet)]"
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

// ─── Sub-components ───

function SectionTitle({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="text-lg">{icon}</span>
      <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]">{title}</h2>
      {count !== undefined && (
        <span className="rounded-full bg-[rgba(20,184,166,0.1)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-positive)]">{count}</span>
      )}
    </div>
  );
}

function NoPositions({ label }: { label: string }) {
  return <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">No {label} found for this wallet.</p>;
}

function RefreshBar({ onRefresh }: { onRefresh: () => void }) {
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [ago, setAgo] = useState("just now");
  const [refreshing, setRefreshing] = useState(false);

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
      <span>·</span>
      <button onClick={handleRefresh} disabled={refreshing} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors disabled:opacity-50">
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
      <span>·</span>
      <span>Auto-refreshes every 60s</span>
    </div>
  );
}
