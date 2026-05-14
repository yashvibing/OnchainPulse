import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/components/Header";
import { ProjectsExplorer } from "@/components/ProjectsExplorer";

export const metadata: Metadata = {
  title: "Yield Markets - Onchain Pulse",
  description:
    "Explore Monad market deposits, liquidity, APY, and utilization with DefiLlama and Merkl data.",
};

export default function YieldPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1120px] px-5 pb-16 pt-8">
        <section className="mb-8 border-b border-[var(--color-border)] pb-6 pt-2">
          <h1 className="text-[30px] font-bold text-[var(--color-text-primary)]">
            Yield Markets
          </h1>
          <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            Scan Monad markets by asset, protocol, deposits, liquidity, APY,
            and utilization. Use this page for broad discovery before opening a
            specific opportunity.
          </p>
          <div className="mt-5 h-px w-56 bg-gradient-to-r from-[var(--color-accent-primary)] via-[var(--color-accent-secondary)] to-transparent" />
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
