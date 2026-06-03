import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { NewsAdminForm } from "@/components/NewsAdminForm";
import { NewsTipReviewPanel } from "@/components/NewsTipReviewPanel";

export const metadata: Metadata = {
  title: "News Admin - Onchain Pulse",
  description: "Submit curated news updates for the Onchain Pulse news feed.",
};

export default function NewsAdminPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1040px] px-5 pb-16 pt-10 md:px-6">
        <section className="mb-8 border-b border-[var(--color-border)] pb-8 pt-2">
          <div className="label-caps text-[var(--color-accent-primary)]">
            Curated News
          </div>
          <h1 className="mt-3 text-[40px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
            Add market context
          </h1>
          <p className="mt-3 max-w-[820px] text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
            Submit links or written updates that should appear in Latest News.
            Public search results are not imported into this feed.
          </p>
        </section>

        <div className="grid gap-5">
          <NewsTipReviewPanel />
          <NewsAdminForm />
        </div>
      </main>
    </div>
  );
}
