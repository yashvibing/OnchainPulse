import Link from "next/link";
import Image from "next/image";

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl">
      <Link href="/" className="flex items-center gap-3">
        <Image
          src="/onchainpulse-mark.png"
          alt=""
          width={44}
          height={37}
          priority
          className="h-9 w-10 rounded-[8px] border border-[rgba(255,255,255,0.08)] object-cover"
        />
        <div className="text-[15px] font-bold tracking-tight text-[var(--color-text-primary)]">
          Onchain Pulse
        </div>
      </Link>
      <nav className="flex items-center gap-4 text-[12px] font-medium text-[var(--color-text-muted)]">
        <Link href="/" className="transition-colors hover:text-[var(--color-text-secondary)]">
          Portfolio
        </Link>
        <Link href="/yield-aggregator" className="transition-colors hover:text-[var(--color-text-secondary)]">
          DeFi Rates
        </Link>
        <Link href="/startups" className="transition-colors hover:text-[var(--color-text-secondary)]">
          Startups
        </Link>
      </nav>
    </header>
  );
}
