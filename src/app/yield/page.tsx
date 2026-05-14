import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/components/Header";
import { ProjectsExplorer } from "@/components/ProjectsExplorer";

export const metadata: Metadata = {
  title: "Yield - Onchain Pulse",
  description:
    "Explore Monad market deposits, liquidity, APY, and utilization with DefiLlama and Merkl data.",
};

export default function YieldPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1120px] px-5 pb-16 pt-8">
        <section className="mb-7 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-5 py-5">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-[var(--radius-sm)] bg-[rgba(0,232,123,0.1)] px-2 py-1 text-[10px] font-bold uppercase text-[var(--color-positive)]">
              Market Explorer
            </span>
            <span className="rounded-[var(--radius-sm)] bg-[rgba(167,139,250,0.12)] px-2 py-1 text-[10px] font-bold uppercase text-[var(--color-accent-violet)]">
              DefiLlama + Merkl
            </span>
          </div>
          <h1 className="text-[30px] font-bold text-[var(--color-text-primary)]">
            Yield
          </h1>
          <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            Scan Monad markets by asset, protocol, deposits, liquidity, APY,
            and utilization. Use this page for broad discovery before opening a
            specific opportunity.
          </p>
        </section>

        <Suspense
          fallback={
            <div className="py-16 text-center text-[13px] text-[var(--color-text-muted)]">
              Loading Monad market data...
            </div>
          }
        >
          <ProjectsExplorer />
        </Suspense>
      </main>
    </div>
  );
}
