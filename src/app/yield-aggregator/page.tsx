import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { YieldAggregator } from "@/components/YieldAggregator";

export const metadata: Metadata = {
  title: "DeFi Rates - Onchain Pulse",
  description:
    "Compare displayed DeFi rates across lending, borrowing, LP, and vault markets relating to Monad.",
};

export default function YieldAggregatorPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1120px] px-5 pb-16 pt-8">
        <section className="mb-8 border-b border-[var(--color-border)] pb-6 pt-2">
          <h1 className="text-[30px] font-bold text-[var(--color-text-primary)]">
            DeFi Rates
          </h1>
          <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            Compare displayed DeFi rates across lending, borrowing, LP, and
            vault markets relating to Monad. Start broad, or choose a lend
            token, a borrow token, or both to find matching markets and loop
            scenarios.
          </p>
          <div className="mt-5 h-px w-56 bg-gradient-to-r from-[var(--color-accent-secondary)] via-[var(--color-accent-violet)] to-transparent" />
        </section>

        <YieldAggregator />
      </main>
    </div>
  );
}
