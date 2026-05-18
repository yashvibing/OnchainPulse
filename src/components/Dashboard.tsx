"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePortfolio, useTokenApprovals } from "@/hooks/usePortfolio";
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
import { ApprovalManager } from "@/components/ApprovalManager";
import { shortenAddress, isValidEvmAddress, formatUsd } from "@/lib/format";
import { fetchYieldOpportunities, type YieldOpportunity } from "@/services/yields-aggregator";
import { buildWalletYieldMatches } from "@/lib/walletOpportunities";
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
  { key: "security", label: "Security", icon: "⛨" },
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
  const approvals = useTokenApprovals(address);

  function handleSearch(addr: string) {
    setAddress(addr);
    setShowPortfolio(true);
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

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />

      <main className="mx-auto max-w-[1000px] px-5 pb-16 pt-6">


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
            <div className="mx-auto max-w-[520px]">
              <h1 className="text-center text-[28px] font-bold text-[var(--color-text-primary)]">
                Track a Monad wallet
              </h1>
              <p className="mb-5 mt-2 text-center text-[13px] leading-relaxed text-[var(--color-text-muted)]">
                Enter any address to view token holdings, staking, lending,
                liquidity, vaults, and approvals.
              </p>
              <AddressInput onSubmit={handleSearch} initialAddress={address} />
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
                    setCopyFeedback("Copied!");
                    setTimeout(() => setCopyFeedback(null), 2000);
                  });
                }}
                className="text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)] transition-colors"
              >
                Copy
              </button>
              <button
                onClick={() => {
                  const v = Math.round(portfolio.totalValue);
                  const y = Math.round(portfolio.dailyYield * 100) / 100;
                  const d = `${address}|${v}|${y}|${portfolio.positionCount}|${portfolio.protocolCount}`;
                  const url = `${window.location.origin}?address=${address}&d=${encodeURIComponent(d)}`;
                  navigator.clipboard.writeText(url).then(() => {
                    setCopyFeedback("Card link copied!");
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
              <div className="ml-auto">
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

                <IdleOpportunityPanel
                  address={address}
                  tokens={portfolio.tokens}
                />

                <RefreshBar onRefresh={portfolio.refetch} />

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

                  {activeTab === "security" && (
                    <div className="animate-fade-up">
                      <SectionTitle icon="⛨" title="Token Approvals" count={approvals.data?.length} />
                      <ApprovalManager
                        approvals={approvals.data || []}
                        isLoading={approvals.isLoading}
                        isConnected={false}
                        onRevoked={() => approvals.refetch()}
                      />
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

// ─── Sub-components ───

function SectionTitle({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="text-lg">{icon}</span>
      <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]">{title}</h2>
      {count !== undefined && (
        <span className="rounded-full bg-[rgba(0,232,123,0.1)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-positive)]">{count}</span>
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
      <div className="mb-2 text-[10px] font-semibold uppercase text-[var(--color-text-dim)]">
        Saved Addresses
      </div>
      <div className="flex flex-wrap gap-2">
        {addresses.map((item) => {
          const active = activeAddress?.toLowerCase() === item.address.toLowerCase();
          return (
            <div
              key={item.address}
              className={`flex items-center gap-1 rounded-[var(--radius-md)] border px-2 py-1.5 text-[11px] ${
                active
                  ? "border-[var(--color-accent-primary)] bg-[rgba(0,232,123,0.08)] text-[var(--color-positive)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(item.address)}
                className="font-mono hover:text-[var(--color-text-primary)]"
              >
                {item.label}
              </button>
              <button
                type="button"
                aria-label={`Remove ${item.label}`}
                onClick={() => onRemove(item.address)}
                className="ml-1 text-[var(--color-text-dim)] hover:text-[var(--color-negative)]"
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

function IdleOpportunityPanel({
  address,
  tokens,
}: {
  address: string;
  tokens: ReturnType<typeof usePortfolio>["tokens"];
}) {
  const [opportunities, setOpportunities] = useState<YieldOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchYieldOpportunities()
      .then((data) => {
        if (!mounted) return;
        setOpportunities(data);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="mb-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4">
        <div className="h-4 w-44 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
        <div className="mt-3 h-3 w-full max-w-[520px] animate-pulse rounded bg-[rgba(255,255,255,0.05)]" />
      </section>
    );
  }

  const matches = buildWalletYieldMatches(tokens, opportunities).slice(0, 4);
  if (matches.length === 0 && tokens.length === 0) return null;

  const totalDaily = matches.reduce((sum, match) => sum + match.estimatedDailyUsd, 0);

  return (
    <section className="mb-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]">
            Matching Markets
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            Lending market rows matched to tokens already sitting in this wallet.
          </p>
        </div>
        <div className="text-left md:text-right">
          <div className="text-[10px] uppercase text-[var(--color-text-dim)]">APR-based estimate</div>
          <div className="text-[16px] font-bold text-[var(--color-positive)]">
            {formatUsd(totalDaily)}
          </div>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-3 py-4 text-[12px] text-[var(--color-text-muted)]">
          No direct lending matches found for this wallet&apos;s current token holdings.
        </div>
      ) : (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {matches.map((match) => (
            <Link
              key={`${match.symbol}-${match.opportunity.id}`}
              href={`/yield-aggregator?address=${address}&lend=${match.symbol}`}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-3 py-3 transition-colors hover:border-[var(--color-border-hover)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-bold text-[var(--color-text-primary)]">
                    {match.symbol}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--color-text-dim)]">
                    {match.balanceLabel} - {formatUsd(match.valueUsd)}
                  </div>
                  <div className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                    Top displayed rate: {match.opportunity.protocol}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-bold text-[var(--color-positive)]">
                    {match.opportunity.apr.toFixed(2)}%
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--color-text-dim)]">
                    Est. daily {formatUsd(match.estimatedDailyUsd)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
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
    </div>
  );
}
