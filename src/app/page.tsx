import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";

interface PageProps {
  searchParams: Promise<{ address?: string }>;
}

export const metadata: Metadata = {
  title: "Onchain Pulse - Portfolio, Token Markets, DeFi Rates & Alerts",
  description:
    "Explore public portfolios, token markets, displayed DeFi rates, latest news, Telegram alerts, and Monad ecosystem context.",
  openGraph: {
    title: "Onchain Pulse - Portfolio, Token Markets, DeFi Rates & Alerts",
    description:
      "Inspect public portfolios, scan token markets, compare displayed DeFi rates, follow latest news, set Telegram alerts, and browse Monad ecosystem context.",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Onchain Pulse - Portfolio, Token Markets, DeFi Rates & Alerts",
    images: ["/api/og"],
  },
};

const FEATURE_CARDS = [
  {
    title: "Portfolio Tracker",
    body: "Paste a public wallet to inspect holdings, staking, lending, vaults, liquidity, and exports.",
    href: "/app",
  },
  {
    title: "Token Markets",
    body: "Scan prices, volume, liquidity, market cap, FDV, contracts, and short-term charts.",
    href: "/token-markets",
  },
  {
    title: "DeFi Rates",
    body: "Compare displayed lending, staking, LP, vault, and borrow opportunities across protocols.",
    href: "/defi-rates",
  },
  {
    title: "Latest News",
    body: "Read Monad and crypto updates from tracked X sources and curated ecosystem context.",
    href: "/news",
  },
  {
    title: "DeltaV Startups",
    body: "Discover startups and continue to DeltaV when you want to give founder feedback.",
    href: "/startups",
  },
  {
    title: "Telegram Alerts",
    body: "Create rate watches, new-market alerts, and best-place change alerts in Telegram.",
    href: "/alerts",
  },
];

const ALERT_POINTS = [
  "APR crosses a target you care about.",
  "A new DeFi market appears.",
  "The best displayed place for a token changes.",
  "Important news, briefs, and startup highlights can be pushed to Telegram as the audience grows.",
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
              Monad portfolios, DeFi rates, token markets, news, and alerts.
            </h1>
            <p className="mt-4 max-w-[760px] text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
              Onchain Pulse helps users understand what is happening across
              Monad wallets, markets, and ecosystem activity without connecting
              a wallet.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/app"
                className="rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-5 py-3 text-[13px] font-bold text-[#07110C] transition-opacity hover:opacity-90"
              >
                Open Portfolio Tracker
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
              What users can do
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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

        <section className="grid gap-4 border-t border-[var(--color-border)] py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
            <div className="label-caps text-[var(--color-accent-primary)]">
              Telegram alerts
            </div>
            <h2 className="mt-3 text-[28px] font-bold tracking-[-0.01em] text-[var(--color-text-primary)]">
              Useful updates without refreshing the app.
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
              Users can connect Telegram and get notified when market conditions
              match what they care about.
            </p>
            <div className="mt-5 grid gap-2">
              {ALERT_POINTS.map((point) => (
                <div
                  key={point}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(0,245,204,0.035)] px-4 py-3 text-[13px] font-semibold text-[var(--color-text-secondary)]"
                >
                  {point}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
            <div className="label-caps text-[var(--color-accent-primary)]">
              Distribution layer
            </div>
            <h2 className="mt-3 text-[28px] font-bold tracking-[-0.01em] text-[var(--color-text-primary)]">
              A direct line to Monad users.
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
              Personal alerts help individual users. The Onchain Pulse Telegram
              channel can also carry broader product updates, launch updates,
              DeFi briefs, ecosystem news, and selected DeltaV startup spotlights.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
              As the audience grows, this makes distribution less dependent on
              outside channels while giving builders another way to get attention
              and feedback.
            </p>
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
