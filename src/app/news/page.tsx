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

      <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-8 md:px-6">
        <section className="mb-6 border-b border-[var(--color-border)] pb-6 pt-2">
          <div className="label-caps text-[var(--color-accent-primary)]">
            Market context
          </div>
          <h1 className="mt-3 text-[34px] font-bold text-[var(--color-text-primary)] md:text-[40px]">
            Latest news
          </h1>
          <p className="mt-2 max-w-[720px] text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
            Curated Monad and DeFi updates rewritten into quick reads before you open the source.
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
