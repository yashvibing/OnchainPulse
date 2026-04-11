import { type VaultPosition } from "@/services/vaults";
import { formatUsd, formatNumber } from "@/lib/format";

interface VaultCardsProps {
  positions: VaultPosition[];
}

export function VaultCards({ positions }: VaultCardsProps) {
  return (
    <div className="grid gap-3">
      {positions.map((pos) => (
        <div
          key={pos.vaultName}
          className="card card-hover px-5 py-5"
          style={{ borderLeft: `3px solid ${pos.color}` }}
        >
          <div className="mb-3 flex items-start justify-between">
            <div>
              <div className="text-[15px] font-bold text-[var(--color-text-primary)]">
                {pos.vaultName}
              </div>
              <div className="text-[11.5px] text-[var(--color-text-muted)]">
                Yield Vault
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
                Deposited
              </div>
              <div className="text-[14.5px] font-semibold text-[var(--color-text-primary)]">
                {formatNumber(parseFloat(pos.underlyingBalance), 2)}{" "}
                {pos.underlyingSymbol}
              </div>
              <div className="text-[11.5px] text-[var(--color-text-muted)]">
                {formatUsd(pos.valueUsd)}
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[10.5px] text-[var(--color-text-dim)]">
                Vault Shares
              </div>
              <div className="text-[14.5px] font-semibold text-[var(--color-positive)]">
                {formatNumber(parseFloat(pos.sharesBalance), 2)}
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
    </div>
  );
}
