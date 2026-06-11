import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { TokenMarkets } from "@/components/TokenMarkets";

export const metadata: Metadata = {
  title: "Token Markets - Onchain Pulse",
  description:
    "View public token market data relating to Monad, including price, 24h change, volume, liquidity, market cap, FDV, and chart snapshots.",
};

export default function TokenMarketsPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-10 md:px-6">
        <section className="mb-8 border-b border-[var(--color-border)] pb-8 pt-2">
          <div className="label-caps text-[var(--color-accent-primary)]">
            Market snapshots
          </div>
          <h1 className="mt-3 text-[40px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
            Token Markets
          </h1>
          <p className="mt-3 max-w-[820px] text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
            View public token market data relating to Monad, including price, 24h change,
            volume, liquidity, market cap, FDV, and charts. Data can be delayed or incomplete.
          </p>
        </section>

        <TokenMarkets />
      </main>
    </div>
  );
}
