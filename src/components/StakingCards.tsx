import { type StakingPosition } from "@/services/staking";
import { formatUsd, formatNumber } from "@/lib/format";

interface StakingCardsProps {
  positions: StakingPosition[];
}

export function StakingCards({ positions }: StakingCardsProps) {
  return (
    <div className="grid gap-3">
      {positions.map((pos, i) => (
        <div
          key={pos.protocol}
          className="card card-hover px-5 py-5 animate-fade-up"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {/* Header */}
          <div className="mb-3 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-[15px] font-bold text-[var(--color-text-primary)]">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: pos.color }}
                />
                {pos.protocol}
              </div>
              <div className="text-[12px] text-[var(--color-text-muted)]">
                Liquid Staking
              </div>
            </div>
            <span className="rounded-full bg-[rgba(20,184,166,0.1)] px-3 py-1 text-[12px] font-bold text-[var(--color-positive)]">
              {pos.apy.toFixed(1)}% source APY
            </span>
          </div>

          {/* Source-rate progress bar shows APY as a visual reference. */}
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-[var(--color-text-dim)]">Source APY</span>
              <span className="font-semibold text-[var(--color-positive)]">{pos.apy.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.04)]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(pos.apy / 25 * 100, 100)}%`,
                  background: `linear-gradient(90deg, ${pos.color}, var(--color-positive))`,
                }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="mb-0.5 text-[11px] text-[var(--color-text-dim)]">
                Staked
              </div>
              <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                {formatNumber(parseFloat(pos.lstBalance), 0)} {pos.lstSymbol}
              </div>
              <div className="text-[12px] text-[var(--color-text-muted)]">
                {formatUsd(pos.stakedValueUsd)}
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[11px] text-[var(--color-text-dim)]">
                MON Equivalent
              </div>
              <div className="text-[14px] font-semibold text-[var(--color-positive)]">
                {formatNumber(parseFloat(pos.monEquivalent), 2)} MON
              </div>
              <div className="text-[12px] text-[var(--color-text-muted)]">
                Rate: 1 {pos.lstSymbol} = {pos.exchangeRate.toFixed(4)} MON
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[11px] text-[var(--color-text-dim)]">
                Estimated Daily Amount
              </div>
              <div className="text-[14px] font-semibold text-[var(--color-accent-violet)]">
                ≈ {formatUsd((pos.stakedValueUsd * pos.apy) / 36500)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
