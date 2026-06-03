import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";

interface PageProps {
  searchParams: Promise<{ address?: string }>;
}

export const metadata: Metadata = {
  title: "Onchain Pulse - Portfolio, DeFi Rates & Alerts",
  description:
    "A read-only interface for public portfolio tracking, displayed DeFi rates, latest news, Telegram alerts, and Monad ecosystem context.",
  openGraph: {
    title: "Onchain Pulse - Portfolio, DeFi Rates & Alerts",
    description:
      "Inspect public portfolios, compare displayed DeFi rates, follow latest news, set Telegram alerts, and browse Monad ecosystem context.",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Onchain Pulse - Portfolio, DeFi Rates & Alerts",
    images: ["/api/og"],
  },
};

const FEATURE_CARDS = [
  {
    title: "Portfolio Tracker",
    body: "Paste a wallet to inspect positions, trends, and CSV exports.",
    href: "/app",
  },
  {
    title: "DeFi Rates",
    body: "Compare lending, staking, LP, vault, and borrow markets.",
    href: "/defi-rates",
  },
  {
    title: "Latest News",
    body: "Read curated Monad, DeFi, and ecosystem updates.",
    href: "/news",
  },
  {
    title: "Ecosystem",
    body: "Browse DeltaV startups and continue to founder feedback.",
    href: "/startups",
  },
  {
    title: "Telegram Alerts",
    body: "Create rate watches, new-market alerts, and daily briefs.",
    href: "/alerts",
  },
];

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const address = params.address;

  if (address && /^0x[a-fA-F0-9]{40}$/.test(address)) {
    const query = new URLSearchParams({ address });
    redirect(`/app?${query.toString()}`);
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-10 md:px-6">
        <section className="border-b border-[var(--color-border)] pb-10 pt-8">
          <div>
            <h1 className="max-w-[900px] text-[42px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] md:text-[64px]">
              Track portfolios, compare DeFi rates, and stay updated.
            </h1>
            <p className="mt-4 max-w-[760px] text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
              Paste a public wallet, explore displayed Monad-related rates, follow
              curated updates, and send alerts to Telegram without connecting a wallet.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/app"
                className="rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-5 py-3 text-[13px] font-bold text-[#07110C] transition-opacity hover:opacity-90"
              >
                Open App
              </Link>
            </div>
          </div>
        </section>

        <section className="py-10">
          <div className="mb-4">
            <div className="label-caps text-[var(--color-accent-primary)]">
              Product areas
            </div>
            <h2 className="mt-2 text-[24px] font-bold text-[var(--color-text-primary)]">
              Choose what you need
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {FEATURE_CARDS.map((feature) => (
              <Link
                key={feature.title}
                href={feature.href}
                className="group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 transition-colors hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-card-hover)]"
              >
                <div className="text-[15px] font-bold text-[var(--color-text-primary)]">
                  {feature.title}
                </div>
                <p className="mt-2 min-h-[36px] text-[12px] leading-relaxed text-[var(--color-text-muted)]">
                  {feature.body}
                </p>
                <div className="mt-4 text-[12px] font-bold text-[var(--color-accent-primary)]">
                  Open -&gt;
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-5">
          <div className="text-[12px] font-bold uppercase text-[var(--color-text-dim)]">
            Independent interface
          </div>
          <p className="mt-2 max-w-[900px] text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            Onchain Pulse is an independent, unofficial interface. It is not
            associated with, endorsed by, or affiliated with Monad Foundation.
            Data is third-party and may be incomplete or change without notice.
          </p>
        </section>
      </main>
    </div>
  );
}
