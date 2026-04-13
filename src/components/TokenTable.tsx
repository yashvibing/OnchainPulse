import { type TokenBalance } from "@/services/tokens";
import { formatUsd, formatNumber } from "@/lib/format";

interface TokenTableProps {
  tokens: TokenBalance[];
  compact?: boolean;
}

// Token icon URL from Monad token list or a fallback colored circle
function TokenIcon({ symbol, logoColor }: { symbol: string; logoColor?: string }) {
  const color = logoColor || "#5A5A74";
  return (
    <div
      className="flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold text-white"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}88)` }}
    >
      {symbol.slice(0, 2)}
    </div>
  );
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
          className={`animate-fade-up grid grid-cols-[2fr_1.2fr_1fr_80px] items-center px-5 py-3 ${
            i < tokens.length - 1
              ? "border-b border-[rgba(255,255,255,0.025)]"
              : ""
          }`}
          style={{ animationDelay: `${i * 30}ms` }}
        >
          <div className="flex items-center gap-2.5">
            <TokenIcon symbol={t.token.symbol} logoColor={t.token.logoColor} />
            <div>
              <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                {t.token.symbol}
              </span>
              {!compact && (
                <div className="text-[11px] text-[var(--color-text-dim)]">
                  {t.token.name}
                </div>
              )}
            </div>
          </div>
          <div className="text-right font-mono text-[12px] text-[var(--color-text-secondary)]">
            {formatNumber(parseFloat(t.formatted), parseFloat(t.formatted) < 1 ? 6 : 2)}
          </div>
          <div className="text-right text-[13px] font-semibold text-[var(--color-text-primary)]">
            {formatUsd(t.valueUsd)}
          </div>
          <div
            className={`text-right text-[12px] font-semibold ${
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
