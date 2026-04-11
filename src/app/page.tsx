"use client";

import { useState } from "react";
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
import { EmptyState, LoadingSpinner } from "@/components/EmptyState";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "tokens", label: "Tokens" },
  { key: "staking", label: "Staking" },
  { key: "liquidity", label: "Liquidity" },
  { key: "lending", label: "Lending" },
  { key: "yield", label: "Yield Vaults" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function DashboardPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const portfolio = usePortfolio(address);

  function handleSearch(addr: string) {
    setAddress(addr);
    setActiveTab("overview");
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[920px] px-5 pb-16 pt-6">
        <AddressInput onSubmit={handleSearch} />

        {/* Loading */}
        {portfolio.isLoading && <LoadingSpinner />}

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

            <TabBar
              tabs={TABS}
              active={activeTab}
              onChange={(key) => setActiveTab(key as TabKey)}
            />

            {/* ── Overview ── */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Top tokens */}
                {portfolio.tokens.length > 0 && (
                  <section>
                    <SectionTitle icon="◈" title="Top Holdings" />
                    <TokenTable
                      tokens={portfolio.tokens.slice(0, 5)}
                      compact
                    />
                  </section>
                )}

                {/* Staking summary */}
                {portfolio.staking.length > 0 && (
                  <section>
                    <SectionTitle icon="⬡" title="Active Staking" />
                    <StakingCards positions={portfolio.staking} />
                  </section>
                )}

                {/* Liquidity summary */}
                {portfolio.liquidity.length > 0 && (
                  <section>
                    <SectionTitle icon="◇" title="Liquidity Positions" />
                    <LiquidityCards positions={portfolio.liquidity} />
                  </section>
                )}

                {/* Lending summary */}
                {portfolio.lending.length > 0 && (
                  <section>
                    <SectionTitle icon="⊞" title="Lending & Borrowing" />
                    <LendingCards positions={portfolio.lending} />
                  </section>
                )}

                {/* Vault summary */}
                {portfolio.vaults.length > 0 && (
                  <section>
                    <SectionTitle icon="⬢" title="Yield Vaults" />
                    <VaultCards positions={portfolio.vaults} />
                  </section>
                )}
              </div>
            )}

            {/* ── Tokens ── */}
            {activeTab === "tokens" && (
              <div>
                <SectionTitle
                  icon="◈"
                  title="Token Holdings"
                  count={portfolio.tokens.length}
                />
                <TokenTable tokens={portfolio.tokens} />
              </div>
            )}

            {/* ── Staking ── */}
            {activeTab === "staking" && (
              <div>
                <SectionTitle
                  icon="⬡"
                  title="Staking Positions"
                  count={portfolio.staking.length}
                />
                {portfolio.staking.length > 0 ? (
                  <StakingCards positions={portfolio.staking} />
                ) : (
                  <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
                    No staking positions found for this wallet.
                  </p>
                )}
              </div>
            )}

            {/* ── Liquidity ── */}
            {activeTab === "liquidity" && (
              <div>
                <SectionTitle
                  icon="◇"
                  title="Liquidity Positions"
                  count={portfolio.liquidity.length}
                />
                {portfolio.liquidity.length > 0 ? (
                  <LiquidityCards positions={portfolio.liquidity} />
                ) : (
                  <NoPositions label="liquidity positions" />
                )}
              </div>
            )}

            {/* ── Lending ── */}
            {activeTab === "lending" && (
              <div>
                <SectionTitle
                  icon="⊞"
                  title="Lending & Borrowing"
                  count={portfolio.lending.length}
                />
                {portfolio.lending.length > 0 ? (
                  <LendingCards positions={portfolio.lending} />
                ) : (
                  <NoPositions label="lending positions" />
                )}
              </div>
            )}

            {/* ── Yield ── */}
            {activeTab === "yield" && (
              <div>
                <SectionTitle
                  icon="⬢"
                  title="Yield Vaults"
                  count={portfolio.vaults.length}
                />
                {portfolio.vaults.length > 0 ? (
                  <VaultCards positions={portfolio.vaults} />
                ) : (
                  <NoPositions label="yield vault positions" />
                )}
              </div>
            )}

            {/* Footer */}
            <footer className="mt-12 text-center text-[11px] leading-relaxed text-[var(--color-text-dim)]">
              <p>
                MonFolio is a community-built tool. Not affiliated with Monad
                Foundation.
              </p>
              <p className="mt-1">
                Data powered by Monad RPC · DefiLlama
              </p>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

// ─── Small sub-components ───

function SectionTitle({
  icon,
  title,
  count,
}: {
  icon: string;
  title: string;
  count?: number;
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="text-lg">{icon}</span>
      <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]">
        {title}
      </h2>
      {count !== undefined && (
        <span className="rounded-full bg-[rgba(20,184,166,0.1)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-positive)]">
          {count}
        </span>
      )}
    </div>
  );
}

function NoPositions({ label }: { label: string }) {
  return (
    <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
      No {label} found for this wallet.
    </p>
  );
}
