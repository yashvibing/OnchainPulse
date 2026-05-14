import Link from "next/link";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-3">
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
          Yield Aggregator
        </Link>
        <Link href="/yield" className="transition-colors hover:text-[var(--color-text-secondary)]">
          Yield
        </Link>
      </nav>
    </header>
  );
}
