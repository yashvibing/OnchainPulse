import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";

interface PageProps {
  searchParams: Promise<{ address?: string }>;
}

export const metadata: Metadata = {
  title: "Onchain Pulse - Monad Markets, DeFi Rates, News & Alerts",
  description:
    "Token markets, displayed DeFi rates, chain analytics, latest news, Telegram alerts, and public portfolio views for the Monad ecosystem.",
  openGraph: {
    title: "Onchain Pulse - Monad Markets, DeFi Rates, News & Alerts",
    description:
      "Scan token markets, compare displayed DeFi rates, review chain analytics, follow latest news, set Telegram alerts, and inspect public portfolios on Monad.",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Onchain Pulse - Monad Markets, DeFi Rates, News & Alerts",
    images: ["/api/og"],
  },
};

const FEATURE_CARDS = [
  {
    title: "Token Markets",
    eyebrow: "Markets",
    body: "Scan prices, volume, liquidity, market cap, FDV, contracts, and short-term token charts.",
    href: "/token-markets",
  },
  {
    title: "DeFi Rates",
    eyebrow: "Rates",
    body: "Compare displayed staking, lending, LP, borrow, and vault opportunities across protocol sources.",
    href: "/defi-rates",
  },
  {
    title: "Analytics",
    eyebrow: "Signals",
    body: "Review chain metrics, source health, and ecosystem activity from the monitoring view.",
    href: "/analytics",
  },
  {
    title: "News",
    eyebrow: "Ecosystem",
    body: "Read curated Monad and DeFi updates, with sources one tap away.",
    href: "/news",
  },
  {
    title: "Telegram Alerts",
    eyebrow: "Alerts",
    body: "Set APR thresholds, new-market alerts, displayed-rate changes, and daily briefs for Telegram.",
    href: "/alerts",
  },
  {
    title: "Portfolio Tracker",
    eyebrow: "Portfolio",
    body: "Paste any public EVM wallet or load a demo wallet to inspect Monad holdings, positions, charts, and exports.",
    href: "/app",
  },
  {
    title: "Ecosystem",
    eyebrow: "Directory",
    body: "Browse DeltaV startup listings and open DeltaV to leave feedback.",
    href: "/startups",
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

      <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-8 md:px-6">
        <section className="border-b border-[var(--color-border)] pb-10 pt-6">
          <div>
            <div className="label-caps text-[var(--color-accent-primary)]">
              Read-only Monad intelligence
            </div>
            <h1 className="mt-4 max-w-[840px] text-[40px] font-bold text-[var(--color-text-primary)] md:text-[60px]">
              The pulse of the Monad&nbsp;ecosystem.
            </h1>
            <p className="mt-4 max-w-[760px] text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
              Token markets, DeFi rates, chain analytics, curated news, and
              Telegram alerts in one place, plus a read-only portfolio view
              for any public wallet. No connection required.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/token-markets" className="btn-primary px-5 py-3 text-[13px]">
                Explore markets
              </Link>
              <Link
                href="/app"
                className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-5 py-3 text-[13px] font-bold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
              >
                Track a wallet
              </Link>
            </div>
          </div>
        </section>

        <section className="py-10">
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <div className="label-caps text-[var(--color-accent-primary)]">
                Current app areas
              </div>
              <h2 className="mt-2 text-[24px] font-bold text-[var(--color-text-primary)]">
                One toolkit for markets, yields, news, and alerts
              </h2>
            </div>
            <Link
              href="/token-markets"
              className="inline-flex min-h-10 items-center text-[12px] font-bold text-[var(--color-accent-primary)] hover:opacity-80"
            >
              Start with markets &rarr;
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {FEATURE_CARDS.map((feature) => (
              <Link
                key={feature.title}
                href={feature.href}
                className="group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 transition-colors hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-card-hover)]"
              >
                <div className="label-caps text-[var(--color-text-dim)]">
                  {feature.eyebrow}
                </div>
                <div className="mt-3 text-[16px] font-bold text-[var(--color-text-primary)]">
                  {feature.title}
                </div>
                <p className="mt-2 min-h-[54px] text-[12px] leading-relaxed text-[var(--color-text-muted)]">
                  {feature.body}
                </p>
                <div className="mt-4 text-[12px] font-bold text-[var(--color-accent-primary)]">
                  Open &rarr;
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-3 border-y border-[var(--color-border)] py-8 md:grid-cols-3">
          {[
            ["Portfolio coverage", "Tokens, LSTs, MetaMorpho-style lending, LP positions, vaults, prices, and a 7-day sparkline."],
            ["Source context", "DefiLlama, Merkl, protocol metadata, curated ecosystem data, and cache health routes."],
            ["Alert workflow", "Telegram setup for APR thresholds, new markets, rate changes, news, and daily briefs."],
          ].map(([title, body]) => (
            <div key={title}>
              <h3 className="text-[14px] font-bold text-[var(--color-text-primary)]">
                {title}
              </h3>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
                {body}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-10 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-5">
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
