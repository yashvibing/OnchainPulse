import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { YieldAggregator } from "@/components/YieldAggregator";

export const metadata: Metadata = {
  title: "DeFi Rates - Onchain Pulse",
  description:
    "Compare displayed DeFi rates across lending, staking, borrowing, LP, and vault markets relating to Monad.",
};

export default function DefiRatesPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-10 md:px-6">
        <section className="mb-8 border-b border-[var(--color-border)] pb-8 pt-2">
          <div className="label-caps text-[var(--color-accent-primary)]">
            Market terminal
          </div>
          <h1 className="mt-3 text-[40px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
            DeFi Rates
          </h1>
          <p className="mt-3 max-w-[820px] text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
            Compare lending, staking, LP, vault, and borrow markets.
          </p>
        </section>

        <YieldAggregator />
      </main>
    </div>
  );
}
