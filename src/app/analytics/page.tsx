import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";

export const metadata: Metadata = {
  title: "Analytics - Onchain Pulse",
  description:
    "Monad network, validator, market, DeFi, and proposal analytics from public data sources.",
};

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-10 md:px-6">
        <section className="mb-8 border-b border-[var(--color-border)] pb-8 pt-2">
          <div className="label-caps text-[var(--color-accent-primary)]">
            Monad analytics
          </div>
          <h1 className="mt-3 text-[40px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
            Analytics
          </h1>
          <p className="mt-3 max-w-[820px] text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
            Network, validators, DeFi markets, token activity, and proposal updates in one place.
          </p>
        </section>

        <AnalyticsDashboard />
      </main>
    </div>
  );
}
