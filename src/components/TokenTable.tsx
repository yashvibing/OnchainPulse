import { type TokenBalance } from "@/services/tokens";
import { formatUsd, formatNumber } from "@/lib/format";

interface TokenTableProps {
  tokens: TokenBalance[];
  compact?: boolean;
}

export function TokenTable({ tokens, compact }: TokenTableProps) {
  if (tokens.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
        No tokens found.
      </p>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[2fr_1.2fr_1fr_80px] border-b border-[rgba(255,255,255,0.04)] px-5 py-2.5 text-[11px] text-[var(--color-text-dim)]">
        <span>Token</span>
        <span className="text-right">Balance</span>
        <span className="text-right">Value</span>
        <span className="text-right">24h</span>
      </div>

      {/* Rows */}
      {tokens.map((t, i) => (
        <div
          key={t.token.symbol + i}
          className={`grid grid-cols-[2fr_1.2fr_1fr_80px] items-center px-5 py-3 ${
            i < tokens.length - 1
              ? "border-b border-[rgba(255,255,255,0.025)]"
              : ""
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              {t.token.logoColor && (
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: t.token.logoColor }}
                />
              )}
              <span className="text-[13.5px] font-semibold text-[var(--color-text-primary)]">
                {t.token.symbol}
              </span>
            </div>
            {!compact && (
              <div className="mt-0.5 text-[11px] text-[var(--color-text-dim)]">
                {t.token.name}
              </div>
            )}
          </div>
          <div className="text-right font-mono text-[12.5px] text-[var(--color-text-secondary)]">
            {formatNumber(parseFloat(t.formatted), parseFloat(t.formatted) < 1 ? 6 : 2)}
          </div>
          <div className="text-right text-[13.5px] font-semibold text-[var(--color-text-primary)]">
            {formatUsd(t.valueUsd)}
          </div>
          <div
            className={`text-right text-[12.5px] font-semibold ${
              t.change24h === null
                ? "text-[var(--color-text-dim)]"
                : t.change24h >= 0
                  ? "text-[var(--color-positive)]"
                  : "text-[var(--color-negative)]"
            }`}
          >
            {t.change24h === null
              ? "—"
              : `${t.change24h >= 0 ? "+" : ""}${t.change24h.toFixed(1)}%`}
          </div>
        </div>
      ))}
    </div>
  );
}
