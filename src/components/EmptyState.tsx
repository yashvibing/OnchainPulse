export function EmptyState() {
  return (
    <div className="py-14 text-center">
      {/* Pulse animation matching "Onchain Pulse" brand */}
      <div className="relative mx-auto mb-6 h-16 w-16">
        <div className="absolute inset-0 rounded-full bg-[var(--color-accent-indigo)] opacity-20" style={{ animation: "pulse-ring 2s ease-in-out infinite" }} />
        <div className="absolute inset-2 rounded-full bg-[var(--color-accent-indigo)] opacity-30" style={{ animation: "pulse-ring 2s ease-in-out infinite 0.3s" }} />
        <div className="absolute inset-4 rounded-full bg-[var(--color-accent-indigo)] opacity-40" style={{ animation: "pulse-ring 2s ease-in-out infinite 0.6s" }} />
        <div className="gradient-brand-animated absolute inset-5 rounded-full" />
      </div>
      <div className="mb-2 text-[15px] text-[var(--color-text-muted)]">
        Enter a wallet address to view your Monad DeFi portfolio
      </div>
      <div className="mx-auto max-w-[420px] text-[12px] leading-relaxed text-[var(--color-text-dim)]">
        Tracks liquid staking (aPriori, FastLane, Kintsu, Magma), lending
        (Morpho, Neverland, Curvance), Uniswap V3 + Curve LP positions,
        yield vaults, and all token holdings.
      </div>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto mb-5 h-11 w-11 animate-spin rounded-full border-[3px] border-[rgba(109,59,245,0.18)] border-t-[var(--color-accent-indigo)]" />
      <div className="text-[13px] text-[var(--color-text-muted)]">
        Scanning Monad ecosystem…
      </div>
      <div className="mt-1.5 text-[12px] text-[var(--color-text-dim)]">
        aPriori · FastLane · Kintsu · Magma · Morpho · Neverland · Curvance
      </div>
    </div>
  );
}

// ─── Skeleton loading states ───

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-[rgba(255,255,255,0.04)] ${className || ""}`}
      style={{ animation: "pulse-ring 1.5s ease-in-out infinite" }}
    />
  );
}

export function SkeletonStatCards() {
  return (
    <div className="mb-5 flex flex-wrap gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card flex-1 min-w-[155px] px-5 py-4">
          <SkeletonPulse className="mb-2 h-3 w-20" />
          <SkeletonPulse className="mb-1 h-6 w-28" />
          <SkeletonPulse className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card px-5 py-5">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <SkeletonPulse className="mb-1.5 h-4 w-32" />
              <SkeletonPulse className="h-3 w-20" />
            </div>
            <SkeletonPulse className="h-6 w-16 rounded-full" />
          </div>
          <div className="flex gap-6">
            <div>
              <SkeletonPulse className="mb-1 h-3 w-12" />
              <SkeletonPulse className="mb-1 h-4 w-24" />
              <SkeletonPulse className="h-3 w-16" />
            </div>
            <div>
              <SkeletonPulse className="mb-1 h-3 w-12" />
              <SkeletonPulse className="h-4 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-[rgba(255,255,255,0.04)] px-5 py-2.5">
        <SkeletonPulse className="h-3 w-full max-w-[300px]" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={`flex items-center gap-4 px-5 py-3 ${i < rows - 1 ? "border-b border-[rgba(255,255,255,0.025)]" : ""}`}
        >
          <SkeletonPulse className="h-8 w-8 rounded-full" />
          <SkeletonPulse className="h-4 w-16" />
          <div className="flex-1" />
          <SkeletonPulse className="h-4 w-20" />
          <SkeletonPulse className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
