"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/app", label: "Portfolio Tracker" },
  { href: "/token-markets", label: "Token Markets" },
  { href: "/defi-rates", label: "DeFi Rates" },
  { href: "/news", label: "Latest News" },
  { href: "/startups", label: "Ecosystem" },
  { href: "/alerts", label: "Alerts" },
];

export function Header() {
  const pathname = usePathname();
  const showAppNav = pathname !== "/";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-4 px-5 md:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-accent-primary)] bg-[rgba(0,245,204,0.08)]">
            <Image
              src="/onchainpulse-mark.png"
              alt=""
              width={28}
              height={28}
              priority
              className="h-7 w-7 object-contain"
            />
          </span>
          <span className="hidden text-[18px] font-black tracking-[-0.02em] text-[var(--color-accent-primary)] sm:inline">
            Onchain Pulse
          </span>
        </Link>

        {showAppNav && (
          <nav className="flex items-center gap-1 sm:gap-4">
            {NAV_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`border-b-2 px-2 py-2 text-[12px] font-semibold transition-colors sm:text-[14px] ${
                    active
                      ? "border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]"
                      : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-accent-primary)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
