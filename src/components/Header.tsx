export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="gradient-brand flex h-9 w-9 items-center justify-center rounded-[10px] text-base font-extrabold text-white">
          M
        </div>
        <div>
          <div className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
            MonFolio
          </div>
          <div className="text-[9.5px] uppercase tracking-[1.2px] text-[var(--color-text-dim)]">
            Monad Portfolio Tracker
          </div>
        </div>
      </div>
      <div className="text-right text-[9.5px] leading-relaxed text-[var(--color-text-dim)]">
        Community-made tool
        <br />
        Not affiliated with Monad Foundation
      </div>
    </header>
  );
}
