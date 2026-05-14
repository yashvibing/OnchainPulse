import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { YieldAggregator } from "@/components/YieldAggregator";

export const metadata: Metadata = {
  title: "Yield Strategies - Onchain Pulse",
  description:
    "Compare lending and borrowing opportunities across Monad protocols.",
};

export default function YieldAggregatorPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1120px] px-5 pb-16 pt-8">
        <section className="mb-8 border-b border-[var(--color-border)] pb-6 pt-2">
          <h1 className="text-[30px] font-bold text-[var(--color-text-primary)]">
            Yield Strategies
          </h1>
          <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            Compare lending, borrow, LP, and vault opportunities across Monad.
            Select one lend token, one borrow token, or both to move from broad
            discovery into loop strategy matching.
          </p>
          <div className="mt-5 h-px w-56 bg-gradient-to-r from-[var(--color-accent-secondary)] via-[var(--color-accent-violet)] to-transparent" />
        </section>

        <YieldAggregator />
      </main>
    </div>
  );
}
