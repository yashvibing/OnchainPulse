import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { YieldAggregator } from "@/components/YieldAggregator";

export const metadata: Metadata = {
  title: "Yield Aggregator - Onchain Pulse",
  description:
    "Compare lending and borrowing opportunities across Monad protocols.",
};

export default function YieldPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1000px] px-5 pb-16 pt-8">
        <section className="mb-6">
          <h1 className="text-[28px] font-bold text-[var(--color-text-primary)]">
            Yield Aggregator
          </h1>
          <p className="mt-2 max-w-[680px] text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            Compare lending and borrowing rates across Monad protocols. Select
            tokens to narrow the opportunities and find matching loop
            strategies.
          </p>
        </section>

        <YieldAggregator />
      </main>
    </div>
  );
}
