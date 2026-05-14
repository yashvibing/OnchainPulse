import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { YieldAggregator } from "@/components/YieldAggregator";

export const metadata: Metadata = {
  title: "Yield Aggregator - Onchain Pulse",
  description:
    "Compare lending and borrowing opportunities across Monad protocols.",
};

export default function YieldAggregatorPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1120px] px-5 pb-16 pt-8">
        <section className="mb-7 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-5 py-5">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-[var(--radius-sm)] bg-[rgba(59,130,246,0.12)] px-2 py-1 text-[10px] font-bold uppercase text-[var(--color-accent-secondary)]">
              Strategy Finder
            </span>
            <span className="rounded-[var(--radius-sm)] bg-[rgba(167,139,250,0.12)] px-2 py-1 text-[10px] font-bold uppercase text-[var(--color-accent-violet)]">
              Merkl + DefiLlama
            </span>
          </div>
          <h1 className="text-[30px] font-bold text-[var(--color-text-primary)]">
            Yield Aggregator
          </h1>
          <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            Compare lending, borrow, LP, and vault opportunities across Monad.
            Select one lend token, one borrow token, or both to move from broad
            discovery into loop strategy matching.
          </p>
        </section>

        <YieldAggregator />
      </main>
    </div>
  );
}
