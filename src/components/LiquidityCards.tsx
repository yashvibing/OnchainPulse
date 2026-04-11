import { type LiquidityPosition } from "@/services/liquidity";
import { formatUsd } from "@/lib/format";

interface LiquidityCardsProps {
  positions: LiquidityPosition[];
}

export function LiquidityCards({ positions }: LiquidityCardsProps) {
  return (
    <div className="grid gap-3">
      {positions.map((pos) => (
        <div
          key={pos.tokenId}
          className="card card-hover px-5 py-5"
          style={{ borderLeft: `3px solid ${pos.color}` }}
        >
          <div className="mb-3 flex items-start justify-between">
            <div>
              <div className="text-[15px] font-bold text-[var(--color-text-primary)]">
                {pos.token0Symbol} / {pos.token1Symbol}
              </div>
              <div className="text-[11.5px] text-[var(--color-text-muted)]">
                {pos.protocol} · {pos.feeLabel} fee · #{pos.tokenId}
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[12.5px] font-bold ${
                pos.inRange
                  ? "bg-[rgba(20,184,166,0.1)] text-[var(--color-positive)]"
                  : "bg-[rgba(255,255,255,0.05)] text-[var(--color-text-muted)]"
              }`}
            >
              {pos.inRange ? "In Range" : "Out of Range"}
            </span>
          </div>

          <div className="flex flex-wrap gap-6">
            <div>
              <div className="mb-0.5 text-[10.5px] text-[var(--color-text-dim)]">
                Value
              </div>
              <div className="text-[14.5px] font-semibold text-[var(--color-text-primary)]">
                {formatUsd(pos.valueUsd)}
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[10.5px] text-[var(--color-text-dim)]">
                Composition
              </div>
              <div className="text-[12.5px] font-mono text-[var(--color-text-secondary)]">
                {pos.amount0} {pos.token0Symbol}
              </div>
              <div className="text-[12.5px] font-mono text-[var(--color-text-secondary)]">
                {pos.amount1} {pos.token1Symbol}
              </div>
            </div>
            {pos.feesUsd > 0 && (
              <div>
                <div className="mb-0.5 text-[10.5px] text-[var(--color-text-dim)]">
                  Unclaimed Fees
                </div>
                <div className="text-[14.5px] font-semibold text-[var(--color-positive)]">
                  {formatUsd(pos.feesUsd)}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
