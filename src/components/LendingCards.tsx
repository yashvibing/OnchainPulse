import { type LendingPosition } from "@/services/lending";
import { formatUsd, formatNumber } from "@/lib/format";

interface LendingCardsProps {
  positions: LendingPosition[];
}

export function LendingCards({ positions }: LendingCardsProps) {
  const supplies = positions.filter((p) => p.type === "supply");
  const borrows = positions.filter((p) => p.type === "borrow");

  return (
    <div className="grid gap-3">
      {supplies.map((pos, i) => (
        <div
          key={`supply-${pos.protocol}-${i}`}
          className="card card-hover px-5 py-5"
        >
          <div className="mb-3 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-[15px] font-bold text-[var(--color-text-primary)]">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: pos.color }}
                />
                {pos.protocol}
              </div>
              <div className="text-[11.5px] text-[var(--color-text-muted)]">
                Supply
              </div>
            </div>
            {pos.apy > 0 && (
              <span className="rounded-full bg-[rgba(20,184,166,0.1)] px-3 py-1 text-[12.5px] font-bold text-[var(--color-positive)]">
                {pos.apy.toFixed(1)}% APY
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-6">
            <div>
              <div className="mb-0.5 text-[10.5px] text-[var(--color-text-dim)]">
                Supplied
              </div>
              <div className="text-[14.5px] font-semibold text-[var(--color-positive)]">
                {formatNumber(parseFloat(pos.balance), 2)} {pos.asset}
              </div>
              <div className="text-[11.5px] text-[var(--color-text-muted)]">
                {formatUsd(pos.valueUsd)}
              </div>
            </div>
            {pos.apy > 0 && (
              <div>
                <div className="mb-0.5 text-[10.5px] text-[var(--color-text-dim)]">
                  Daily Earnings
                </div>
                <div className="text-[14.5px] font-semibold text-[var(--color-accent-violet)]">
                  ≈ {formatUsd((pos.valueUsd * pos.apy) / 36500)}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {borrows.map((pos, i) => (
        <div
          key={`borrow-${pos.protocol}-${i}`}
          className="card card-hover px-5 py-5"
        >
          <div className="mb-3 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-[15px] font-bold text-[var(--color-text-primary)]">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-negative)]" />
                {pos.protocol}
              </div>
              <div className="text-[11.5px] text-[var(--color-text-muted)]">
                Borrow
              </div>
            </div>
          </div>

          <div>
            <div className="mb-0.5 text-[10.5px] text-[var(--color-text-dim)]">
              Borrowed
            </div>
            <div className="text-[14.5px] font-semibold text-[var(--color-negative)]">
              {formatNumber(parseFloat(pos.balance), 2)} {pos.asset}
            </div>
            <div className="text-[11.5px] text-[var(--color-text-muted)]">
              {formatUsd(pos.valueUsd)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
