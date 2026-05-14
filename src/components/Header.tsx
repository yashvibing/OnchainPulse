import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl">
      <Link href="/" className="flex items-center gap-3">
        <div className="gradient-brand-animated flex h-8 w-8 items-center justify-center rounded-[8px] text-[10px] font-extrabold text-white">
          OP
        </div>
        <div className="text-[15px] font-bold tracking-tight text-[var(--color-text-primary)]">
          Onchain Pulse
        </div>
      </Link>
      <nav className="flex items-center gap-4 text-[12px] font-medium text-[var(--color-text-muted)]">
        <Link href="/" className="transition-colors hover:text-[var(--color-text-secondary)]">
          Portfolio
        </Link>
        <Link href="/yield-aggregator" className="transition-colors hover:text-[var(--color-text-secondary)]">
          Yield Strategies
        </Link>
        <Link href="/yield" className="transition-colors hover:text-[var(--color-text-secondary)]">
          Yield Markets
        </Link>
      </nav>
    </header>
  );
}
