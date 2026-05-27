import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";

interface PageProps {
  searchParams: Promise<{ address?: string; d?: string }>;
}

export const metadata: Metadata = {
  title: "Onchain Pulse - Portfolio & DeFi Rates",
  description:
    "A read-only interface for portfolio tracking, displayed DeFi rates, Telegram alerts, and Monad ecosystem context.",
  openGraph: {
    title: "Onchain Pulse - Portfolio & DeFi Rates",
    description:
      "Inspect public portfolios, compare displayed DeFi rates, set Telegram alerts, and browse Monad ecosystem context.",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Onchain Pulse - Portfolio & DeFi Rates",
    images: ["/api/og"],
  },
};

const FEATURE_CARDS = [
  {
    title: "Portfolio Tracker",
    body: "Paste any public wallet address to inspect tokens, staking, lending, liquidity, and vault exposure.",
    href: "/app",
  },
  {
    title: "Compare DeFi Rates",
    body: "Browse displayed lending, staking, LP, vault, and borrow markets without connecting a wallet.",
    href: "/defi-rates",
  },
  {
    title: "Set Alerts",
    body: "Use Telegram alerts for APR targets, best-place changes, new markets, and daily rate digests.",
    href: "/alerts",
  },
  {
    title: "Read Ecosystem Signals",
    body: "Browse DeltaV startup listings and compact Monad market updates for extra context.",
    href: "/startups",
  },
];

const TRUST_POINTS = [
  "No wallet connection required",
  "Read-only public data",
  "Built for quick Monad research",
];

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const address = params.address;
  const d = params.d;

  if (address && /^0x[a-fA-F0-9]{40}$/.test(address)) {
    const query = new URLSearchParams({ address });
    if (d) query.set("d", d);
    redirect(`/app?${query.toString()}`);
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-10 md:px-6">
        <section className="border-b border-[var(--color-border)] pb-10 pt-8">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="label-caps text-[var(--color-accent-primary)]">
                Read-only Monad intelligence
              </div>
              <h1 className="mt-4 max-w-[820px] text-[42px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] md:text-[64px]">
                Portfolio tracking and DeFi rates in one place.
              </h1>
              <p className="mt-4 max-w-[760px] text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
                Onchain Pulse helps you inspect public wallet activity, compare
                displayed DeFi rates, set Telegram alerts, and follow ecosystem
                context without asking you to connect a wallet.
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

            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
              <div className="text-[12px] font-bold uppercase text-[var(--color-accent-primary)]">
                What it does
              </div>
              <div className="mt-4 space-y-3">
                {TRUST_POINTS.map((point) => (
                  <div
                    key={point}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-3 py-3 text-[13px] font-semibold text-[var(--color-text-primary)]"
                  >
                    {point}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-10">
          <div className="mb-4">
            <div className="label-caps text-[var(--color-accent-primary)]">
              Product areas
            </div>
            <h2 className="mt-2 text-[24px] font-bold text-[var(--color-text-primary)]">
              Choose what you want to inspect
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {FEATURE_CARDS.map((feature) => (
              <Link
                key={feature.title}
                href={feature.href}
                className="group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 transition-colors hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-card-hover)]"
              >
                <div className="text-[15px] font-bold text-[var(--color-text-primary)]">
                  {feature.title}
                </div>
                <p className="mt-2 min-h-[66px] text-[12px] leading-relaxed text-[var(--color-text-muted)]">
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
