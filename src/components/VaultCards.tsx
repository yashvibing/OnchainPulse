import { type VaultPosition } from "@/services/vaults";
import { formatUsd, formatNumber, getPeriodicYieldEstimate } from "@/lib/format";

interface VaultCardsProps {
  positions: VaultPosition[];
}

export function VaultCards({ positions }: VaultCardsProps) {
  return (
    <div className="grid gap-3">
      {positions.map((pos, i) => {
        const estimate = getPeriodicYieldEstimate(
          pos.valueUsd,
          (pos.valueUsd * pos.apy) / 36500
        );

        return (
        <div
          key={pos.vaultName}
          className="card card-hover px-5 py-5 animate-fade-up"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="mb-3 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-[15px] font-bold text-[var(--color-text-primary)]">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: pos.color }}
                />
                {pos.vaultName}
              </div>
              <div className="text-[12px] text-[var(--color-text-muted)]">
                Vault Position
              </div>
            </div>
            {pos.apy > 0 && (
              <span className="rounded-full bg-[rgba(20,184,166,0.1)] px-3 py-1 text-[12px] font-bold text-[var(--color-positive)]">
                {pos.apy.toFixed(1)}% source APY
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-6">
            <div>
              <div className="mb-0.5 text-[11px] text-[var(--color-text-dim)]">
                Deposited
              </div>
              <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                {formatNumber(parseFloat(pos.underlyingBalance), 2)}{" "}
                {pos.underlyingSymbol}
              </div>
              <div className="text-[12px] text-[var(--color-text-muted)]">
                {formatUsd(pos.valueUsd)}
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[11px] text-[var(--color-text-dim)]">
                Vault Shares
              </div>
              <div className="text-[14px] font-semibold text-[var(--color-positive)]">
                {formatNumber(parseFloat(pos.sharesBalance), 2)}
              </div>
            </div>
            {pos.apy > 0 && (
              <div>
                <div className="mb-0.5 text-[11px] text-[var(--color-text-dim)]">
                  {estimate.label}
                </div>
                <div className="text-[14px] font-semibold text-[var(--color-accent-violet)]">
                  ≈ {estimate.formatted}
                </div>
              </div>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}
