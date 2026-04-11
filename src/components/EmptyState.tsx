export function EmptyState() {
  return (
    <div className="py-14 text-center">
      <div className="mb-4 text-[44px] opacity-25">◈</div>
      <div className="mb-2 text-[15px] text-[var(--color-text-muted)]">
        Enter a wallet address to view your Monad DeFi portfolio
      </div>
      <div className="mx-auto max-w-[420px] text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
        Tracks liquid staking (aPriori, FastLane, Kintsu, Magma), Morpho
        lending vaults, and all token holdings. Uniswap V3 LP positions and
        more protocols coming soon.
      </div>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto mb-5 h-11 w-11 animate-spin rounded-full border-[3px] border-[rgba(109,59,245,0.18)] border-t-[var(--color-accent-indigo)]" />
      <div className="text-[13.5px] text-[var(--color-text-muted)]">
        Scanning Monad ecosystem…
      </div>
      <div className="mt-1.5 text-[11.5px] text-[var(--color-text-dim)]">
        aPriori · FastLane · Kintsu · Magma · Morpho
      </div>
    </div>
  );
}
