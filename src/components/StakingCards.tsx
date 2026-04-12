import { type StakingPosition } from "@/services/staking";
import { formatUsd, formatNumber } from "@/lib/format";

interface StakingCardsProps {
  positions: StakingPosition[];
}

export function StakingCards({ positions }: StakingCardsProps) {
  return (
    <div className="grid gap-3">
      {positions.map((pos) => (
        <div
          key={pos.protocol}
          className="card card-hover px-5 py-5"
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
              {pos.apy.toFixed(1)}% APY
            </span>
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
                Daily Earnings
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
