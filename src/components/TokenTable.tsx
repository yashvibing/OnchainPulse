import Image from "next/image";
import { type TokenBalance } from "@/services/tokens";
import { formatNumber, formatUsd } from "@/lib/format";

interface TokenTableProps {
  tokens: TokenBalance[];
  compact?: boolean;
}

function TokenIcon({
  symbol,
  logoColor,
  logoURI,
}: {
  symbol: string;
  logoColor?: string;
  logoURI?: string;
}) {
  const color = logoColor || "#5A5A74";

  if (logoURI) {
    return (
      <Image
        src={logoURI}
        alt={symbol}
        width={28}
        height={28}
        unoptimized
        className="h-7 w-7 rounded-full"
        onError={(event) => {
          const image = event.currentTarget;
          image.style.display = "none";
          image.nextElementSibling?.classList.remove("hidden");
        }}
      />
    );
  }

  return (
    <div
      className="flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold text-white"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}88)` }}
    >
      {symbol.slice(0, 2)}
    </div>
  );
}

function changeLabel(change24h: number | null) {
  if (change24h === null) return "-";
  return `${change24h >= 0 ? "+" : ""}${change24h.toFixed(1)}%`;
}

function changeClass(change24h: number | null) {
  if (change24h === null) return "text-[var(--color-text-dim)]";
  return change24h >= 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]";
}

function formattedBalance(value: string) {
  const parsed = Number.parseFloat(value);
  return formatNumber(parsed, parsed < 1 ? 6 : 2);
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
    <>
      <div className="grid gap-3 md:hidden">
        {tokens.map((token, index) => (
          <div
            key={`${token.token.symbol}-mobile-${index}`}
            className="card animate-fade-up px-4 py-3"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <TokenIcon
                  symbol={token.token.symbol}
                  logoColor={token.token.logoColor}
                  logoURI={token.token.logoURI}
                />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-[var(--color-text-primary)]">
                    {token.token.symbol}
                  </div>
                  {!compact && (
                    <div className="truncate text-[11px] text-[var(--color-text-dim)]">
                      {token.token.name}
                    </div>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                  {formatUsd(token.valueUsd)}
                </div>
                <div className={`text-[11px] font-semibold ${changeClass(token.change24h)}`}>
                  {changeLabel(token.change24h)}
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.035)] px-3 py-2">
              <div className="text-[10px] uppercase text-[var(--color-text-dim)]">Balance</div>
              <div className="mt-1 break-all font-mono text-[12px] text-[var(--color-text-secondary)]">
                {formattedBalance(token.formatted)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card hidden overflow-hidden md:block">
        <div className="grid grid-cols-[2fr_1.2fr_1fr_80px] border-b border-[rgba(255,255,255,0.04)] px-5 py-2.5 text-[11px] text-[var(--color-text-dim)]">
          <span>Token</span>
          <span className="text-right">Balance</span>
          <span className="text-right">Value</span>
          <span className="text-right">24h</span>
        </div>

        {tokens.map((token, index) => (
          <div
            key={`${token.token.symbol}-${index}`}
            className={`animate-fade-up grid grid-cols-[2fr_1.2fr_1fr_80px] items-center px-5 py-3 ${
              index < tokens.length - 1 ? "border-b border-[rgba(255,255,255,0.025)]" : ""
            }`}
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <div className="flex items-center gap-2.5">
              <TokenIcon
                symbol={token.token.symbol}
                logoColor={token.token.logoColor}
                logoURI={token.token.logoURI}
              />
              <div>
                <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                  {token.token.symbol}
                </span>
                {!compact && (
                  <div className="text-[11px] text-[var(--color-text-dim)]">
                    {token.token.name}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right font-mono text-[12px] text-[var(--color-text-secondary)]">
              {formattedBalance(token.formatted)}
            </div>
            <div className="text-right text-[13px] font-semibold text-[var(--color-text-primary)]">
              {formatUsd(token.valueUsd)}
            </div>
            <div className={`text-right text-[12px] font-semibold ${changeClass(token.change24h)}`}>
              {changeLabel(token.change24h)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
