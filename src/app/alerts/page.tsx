import type { Metadata } from "next";
import { AlertCreator } from "@/components/AlertCreator";
import { AlertManagement } from "@/components/AlertManagement";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Alerts - Onchain Pulse",
  description: "Manage Telegram alerts for displayed DeFi rates on Onchain Pulse.",
};

export default function AlertsPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-10 md:px-6">
        <section className="mb-8 border-b border-[var(--color-border)] pb-8 pt-2">
          <div className="label-caps text-[var(--color-accent-primary)]">
            Telegram watchlist
          </div>
          <h1 className="mt-3 text-[40px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
            Alerts
          </h1>
          <p className="mt-3 max-w-[820px] text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
            Telegram alerts for APR thresholds, best-place changes, new markets, and daily briefs.
          </p>
        </section>

        <AlertCreator />
        <AlertManagement />
      </main>
    </div>
  );
}
