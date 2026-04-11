import { type LiquidityPosition, formatFee } from "@/services/liquidity";
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
                Uniswap V3 · {formatFee(pos.fee)} fee
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[12.5px] font-bold ${
                BigInt(pos.liquidity) > 0n
                  ? "bg-[rgba(20,184,166,0.1)] text-[var(--color-positive)]"
                  : "bg-[rgba(255,255,255,0.05)] text-[var(--color-text-muted)]"
              }`}
            >
              {BigInt(pos.liquidity) > 0n ? "Active" : "Closed"}
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
                Uncollected Fees
              </div>
              <div className="text-[14.5px] font-semibold text-[var(--color-positive)]">
                {pos.tokensOwed0} {pos.token0Symbol}
              </div>
              <div className="text-[11.5px] text-[var(--color-text-muted)]">
                {pos.tokensOwed1} {pos.token1Symbol}
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[10.5px] text-[var(--color-text-dim)]">
                Range
              </div>
              <div className="text-[12px] font-mono text-[var(--color-text-secondary)]">
                {pos.tickLower} → {pos.tickUpper}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
