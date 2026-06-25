import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";

export const metadata: Metadata = {
  title: "Monad Analytics - Onchain Pulse",
  description:
    "Monad market, network, DeFi, and liquidity analytics from public data sources.",
};

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1280px] px-4 pb-12 pt-6 md:px-6 md:pt-8">
        <section className="mb-4 border-b border-[var(--color-border)] pb-4">
          <div className="label-caps text-[var(--color-accent-primary)]">
            Monad analytics
          </div>
          <h1 className="mt-2 text-[30px] font-black leading-[0.98] text-[var(--color-text-primary)] md:text-[42px]">
            Market and network intelligence
          </h1>
          <p className="mt-2 max-w-[760px] text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
            Live public data organized by decision: market direction, network health,
            liquidity depth, DEX activity, stablecoins, and DeFi rates.
          </p>
        </section>

        <AnalyticsDashboard />
      </main>
    </div>
  );
}
