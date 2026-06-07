import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { LatestNewsSection } from "@/components/LatestNewsSection";
import { NewsTipSubmitForm } from "@/components/NewsTipSubmitForm";
import { TelegramDistributionPanel } from "@/components/TelegramDistributionPanel";

export const metadata: Metadata = {
  title: "Latest News - Onchain Pulse",
  description:
    "Latest Monad, DeFi, and ecosystem context for Onchain Pulse users.",
};

export default function NewsPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-10 md:px-6">
        <section className="mb-8 border-b border-[var(--color-border)] pb-8 pt-2">
          <div className="label-caps text-[var(--color-accent-primary)]">
            Latest News
          </div>
          <h1 className="mt-3 text-[40px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
            Market context
          </h1>
          <p className="mt-3 max-w-[820px] text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
            Follow curated Monad, DeFi, and ecosystem updates separately from
            portfolio tracking.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <LatestNewsSection />
          <aside className="grid gap-5 lg:sticky lg:top-24">
            <TelegramDistributionPanel compact />
            <NewsTipSubmitForm />
          </aside>
        </div>
      </main>
    </div>
  );
}
