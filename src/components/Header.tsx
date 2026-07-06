"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/app", label: "Portfolio", group: "primary" },
  { href: "/token-markets", label: "Markets", group: "primary" },
  { href: "/defi-rates", label: "Rates", group: "primary" },
  { href: "/alerts", label: "Alerts", group: "primary" },
  { href: "/analytics", label: "Analytics", group: "secondary" },
  { href: "/news", label: "News", group: "secondary" },
  { href: "/startups", label: "Ecosystem", group: "secondary" },
  ...(process.env.NODE_ENV === "development"
    ? [{ href: "/nfts", label: "NFTs (dev)", group: "secondary" }]
    : []),
];

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const showAppNav = true;

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
              style={{ width: 28, height: 28 }}
            />
          </span>
          <span className="text-[16px] font-black tracking-[-0.02em] text-[var(--color-accent-primary)] sm:text-[18px]">
            Onchain Pulse
          </span>
        </Link>

        {showAppNav && (
          <>
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-expanded={menuOpen}
            className="min-h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-[12px] font-bold text-[var(--color-text-secondary)] md:hidden"
          >
            Menu
          </button>
          <nav className="hidden min-w-0 flex-1 items-center justify-end gap-2 md:flex">
            {NAV_ITEMS.map((item, index) => {
              const active = pathname.startsWith(item.href);

              return (
                <div key={item.href} className="flex items-center gap-2">
                {index > 0 && NAV_ITEMS[index - 1]?.group !== item.group && (
                  <span className="h-4 w-px bg-[var(--color-border)]" aria-hidden="true" />
                )}
                <Link
                  href={item.href}
                  className={`shrink-0 border-b-2 px-2 py-2 text-[12px] font-semibold transition-colors sm:text-[14px] ${
                    active
                      ? "border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]"
                      : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-accent-primary)]"
                  }`}
                >
                  {item.label}
                </Link>
                </div>
              );
            })}
          </nav>
          {menuOpen && (
            <nav className="absolute left-3 right-3 top-full grid gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface-solid)] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.45)] md:hidden">
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`rounded-[var(--radius-md)] px-3 py-3 text-[13px] font-bold ${
                      active
                        ? "bg-[rgba(0,245,204,0.1)] text-[var(--color-accent-primary)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
          </>
        )}
      </div>
    </header>
  );
}
