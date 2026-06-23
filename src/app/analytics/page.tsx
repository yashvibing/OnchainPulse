import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";

export const metadata: Metadata = {
  title: "Monad Analytics - Onchain Pulse",
  description:
    "Monad market, network, staking, validator, DeFi, and liquidity analytics from public data sources.",
};

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-10 md:px-6">
        <section className="mb-6 border-b border-[var(--color-border)] pb-6 pt-2">
          <div className="label-caps text-[var(--color-accent-primary)]">
            Monad analytics
          </div>
          <h1 className="mt-3 text-[36px] font-black leading-none text-[var(--color-text-primary)] md:text-[48px]">
            Market and network intelligence
          </h1>
          <p className="mt-3 max-w-[760px] text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
            Live public data organized by decision: market direction, network health,
            liquidity depth, staking security, validator concentration, and DeFi rates.
          </p>
        </section>

        <AnalyticsDashboard />
      </main>
    </div>
  );
}
