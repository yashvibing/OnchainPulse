"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  calculateLoopStrategies,
  fetchYieldOpportunitiesWithClientMeta,
  filterBorrowOpportunities,
  filterByTokens,
  getBorrowCollateralSymbols,
  getOpportunityAssetSymbols,
  sortOpportunities,
  type LoopStrategy,
  type SortField,
  type YieldOpportunity,
} from "@/services/yields-aggregator";
import {
  formatNumber,
} from "@/lib/format";
import { getTokenLogoSrc } from "@/lib/tokenLogos";
import { getProtocolLogoSrc } from "@/lib/protocolLogos";

const POPULAR_TOKENS = [
  "WMON",
  "USDC",
  "USDT0",
  "WETH",
  "AUSD",
  "shMON",
  "aprMON",
  "sMON",
  "gMON",
  "WBTC",
  "cbBTC",
  "USD1",
];

const SUGGESTED_TOKENS = ["USDC", "WETH", "AUSD"];

const DEFI_TERMS = [
  ["APR", "Displayed yearly rate."],
  ["TVL", "Capital in the market."],
  ["Fixed yield", "Pendle PT-style maturity markets."],
  ["Borrow", "Debt against collateral."],
];

function formatUsd(value: number) {
  if (value >= 1_000_000_000) return `$${formatNumber(value / 1_000_000_000, 2)}B`;
  if (value >= 1_000_000) return `$${formatNumber(value / 1_000_000, 2)}M`;
  if (value >= 1_000) return `$${formatNumber(value / 1_000, 1)}K`;
  return `$${formatNumber(value, 0)}`;
}

function formatRateLabel(apr: number) {
  return `${apr.toFixed(2)}% APR`;
}

function isPendleOpportunity(opp: YieldOpportunity) {
  return opp.tags.includes("pendle") || opp.protocol.toLowerCase().includes("pendle");
}

function getRateTitle(opp: YieldOpportunity) {
  if (opp.opportunityType === "Fixed Yield") return "Fixed APY";
  return "Displayed APR";
}

function getRateLabel(opp: YieldOpportunity) {
  if (opp.opportunityType === "Fixed Yield") return `${opp.apr.toFixed(2)}% fixed`;
  return formatRateLabel(opp.apr);
}

function getDisplayProtocolIcon(iconUrl?: string) {
  if (!iconUrl) return null;

  try {
    const url = new URL(iconUrl);
    if (url.hostname === "icons.llama.fi") return null;
    return iconUrl;
  } catch {
    return null;
  }
}

function getExternalUrl(...urls: Array<string | undefined>) {
  for (const value of urls) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" || url.protocol === "http:") return value;
    } catch {
      continue;
    }
  }

  return "";
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "blue" | "violet" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-[rgba(255,255,255,0.06)] text-[var(--color-text-secondary)]",
    positive: "bg-[rgba(0,245,204,0.1)] text-[var(--color-positive)]",
    blue: "bg-[rgba(59,130,246,0.12)] text-[var(--color-accent-secondary)]",
    violet: "bg-[rgba(167,139,250,0.12)] text-[var(--color-accent-violet)]",
    warning: "bg-[rgba(255,184,0,0.12)] text-[var(--color-warning)]",
    danger: "bg-[rgba(255,71,87,0.12)] text-[var(--color-negative)]",
  };

  return (
    <span className={`rounded-[var(--radius-sm)] px-2 py-1 text-[9px] font-bold uppercase ${tones[tone]}`}>
      {children}
    </span>
  );
}

function ProtocolMark({ opp }: { opp: YieldOpportunity }) {
  const [iconFailed, setIconFailed] = useState(false);
  const iconUrl = getProtocolLogoSrc(opp.protocol) || getDisplayProtocolIcon(opp.protocolIcon);
  const initials = opp.protocol
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.06)]"
      aria-hidden="true"
    >
      {iconUrl && !iconFailed ? (
        // Protocol icons can be local SVG/PNG assets or third-party URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setIconFailed(true)}
        />
      ) : (
        <span className="text-[9px] font-bold text-[var(--color-text-secondary)]">{initials || "P"}</span>
      )}
    </div>
  );
}

function AssetStack({ symbols }: { symbols: string[] }) {
  const visibleSymbols = symbols.length > 0 ? symbols.slice(0, 3) : ["?"];

  return (
    <div className="flex -space-x-2">
      {visibleSymbols.map((symbol, index) => {
        const logoSrc = getTokenLogoSrc(symbol);

        return (
          <div
            key={`${symbol}-${index}`}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--color-bg-primary)] bg-[rgba(255,255,255,0.08)] text-[9px] font-extrabold text-[var(--color-positive)] shadow-[0_8px_22px_rgba(0,0,0,0.22)]"
            style={{ zIndex: visibleSymbols.length - index }}
            title={symbol}
          >
            {logoSrc ? (
              // Local SVG/PNG token marks render more predictably as plain images.
              // Protocol marks still use next/image because many are remote URLs.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt=""
                className="h-full w-full object-contain"
                loading="lazy"
              />
            ) : (
              symbol.slice(0, 2).toUpperCase()
            )}
          </div>
        );
      })}
    </div>
  );
}

function TokenChip({
  symbol,
  selected,
  onClick,
}: {
  symbol: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[var(--radius-md)] border px-3 py-2 text-[12px] font-semibold transition-all ${
        selected
          ? "border-[var(--color-accent-primary)] bg-[rgba(0,245,204,0.12)] text-[var(--color-positive)]"
          : "border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-secondary)]"
      }`}
    >
      {symbol}
    </button>
  );
}

function TokenSelectorPanel({
  title,
  subtitle,
  tone,
  tokens,
  selectedTokens,
  onSelect,
}: {
  title: string;
  subtitle: string;
  tone: "positive" | "blue";
  tokens: string[];
  selectedTokens: string[];
  onSelect: (symbol: string) => void;
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div
            className={`text-[12px] font-bold uppercase ${
              tone === "positive" ? "text-[var(--color-positive)]" : "text-[var(--color-accent-secondary)]"
            }`}
          >
            {title}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            {subtitle}
          </p>
        </div>
        {selectedTokens.length > 0 && <Badge tone={tone}>{selectedTokens[0]}</Badge>}
      </div>
      <div className="flex flex-wrap gap-2">
        {tokens.map((symbol) => (
          <TokenChip
            key={symbol}
            symbol={symbol}
            selected={selectedTokens.includes(symbol)}
            onClick={() => onSelect(symbol)}
          />
        ))}
      </div>
    </section>
  );
}

function RateExplainerStrip() {
  return (
    <section className="mb-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(0,245,204,0.04)] px-4 py-4">
      <div className="grid gap-2 md:grid-cols-4">
        {DEFI_TERMS.map(([term, description]) => (
          <div
            key={term}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-3 py-3"
          >
            <div className="text-[12px] font-bold text-[var(--color-text-primary)]">{term}</div>
            <div className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              {description}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SortButton({
  label,
  field,
  current,
  onClick,
}: {
  label: string;
  field: SortField;
  current: SortField;
  onClick: (field: SortField) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(field)}
      className={`rounded-[var(--radius-md)] border px-3 py-2 text-[12px] font-semibold transition-colors ${
        current === field
          ? "border-[var(--color-accent-primary)] bg-[rgba(0,245,204,0.1)] text-[var(--color-positive)]"
          : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      {label}
    </button>
  );
}

function protocolFilterKey(protocol: string) {
  return protocol.trim().toLowerCase();
}

function getOpportunityActionBadge(opp: YieldOpportunity): {
  label: string;
  tone: "positive" | "blue" | "violet" | "warning";
} {
  if (opp.action === "BORROW") return { label: "Borrow", tone: "blue" };
  if (opp.opportunityType === "Fixed Yield") return { label: "Fixed", tone: "warning" };
  if (opp.opportunityType === "Stake") return { label: "Stake", tone: "positive" };
  if (opp.opportunityType === "LP") return { label: "LP", tone: "violet" };
  if (opp.opportunityType === "Vault") return { label: "Vault", tone: "violet" };
  return { label: "Lend", tone: "positive" };
}

function preferredProtocolLabel(current: string | undefined, next: string) {
  if (!current) return next;
  const currentLooksLowercase = current === current.toLowerCase();
  const nextLooksLowercase = next === next.toLowerCase();
  return currentLooksLowercase && !nextLooksLowercase ? next : current;
}

function ProtocolFilter({
  options,
  selected,
  onSelect,
}: {
  options: { key: string; label: string; count: number }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const selectedOption =
    selected === "all"
      ? { key: "all", label: "All protocols", count: 0 }
      : options.find((option) => option.key === selected);
  const protocolOptions = [{ key: "all", label: "All protocols", count: 0 }, ...options];

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="relative flex min-w-[220px] items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2"
    >
      <span className="text-[11px] font-semibold uppercase text-[var(--color-text-dim)]">
        Protocol
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left text-[12px] font-semibold text-[var(--color-text-secondary)] outline-none transition-colors hover:text-[var(--color-text-primary)] focus:text-[var(--color-text-primary)]"
      >
        <span className="truncate">
          {selectedOption?.label || "All protocols"}
          {selectedOption && selectedOption.key !== "all" ? ` (${selectedOption.count})` : ""}
        </span>
        <span className={`text-[14px] text-[var(--color-text-secondary)] transition-transform ${open ? "rotate-180" : ""}`}>
          v
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[300px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-accent-primary)] bg-[var(--color-bg-surface-solid)] p-1 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
        >
          {protocolOptions.map((option) => {
            const active = option.key === selected;
            const label = option.key === "all" ? option.label : `${option.label} (${option.count})`;

            return (
              <button
                key={option.key}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onSelect(option.key);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-left text-[12px] font-semibold transition-colors ${
                  active
                    ? "bg-[var(--color-accent-primary)] text-[#07110C]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <span className="truncate">{label}</span>
                {active && <span className="text-[10px]">Selected</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OpportunityRow({
  opp,
}: {
  opp: YieldOpportunity;
}) {
  const assetSymbols = getOpportunityAssetSymbols(opp);
  const collateralSymbols = getBorrowCollateralSymbols(opp);
  const tokenLabel =
    assetSymbols.length > 0 ? assetSymbols.join(" / ") : opp.tokens.map((token) => token.symbol).join(" / ");
  const actionBadge = getOpportunityActionBadge(opp);
  const externalUrl = getExternalUrl(opp.depositUrl, opp.protocolUrl);

  return (
    <div className="group block rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4 transition-all hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-card-hover)]">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px] md:items-center">
        <div className="flex min-w-0 gap-3">
          <AssetStack symbols={assetSymbols} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-[14px] font-bold text-[var(--color-text-primary)]">
                {tokenLabel}
              </span>
              <Badge tone={actionBadge.tone}>{actionBadge.label}</Badge>
            </div>
            <div className="mt-2 flex min-w-0 items-center gap-2">
              <ProtocolMark opp={opp} />
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold text-[var(--color-text-secondary)]">
                  {opp.protocol}
                </div>
                <div className="truncate text-[11px] text-[var(--color-text-dim)]">
                  {opp.name}
                </div>
              </div>
            </div>
            {opp.action === "BORROW" && (
              <div className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                Supply/collateral: {collateralSymbols.join(", ")}
              </div>
            )}
            {opp.opportunityType === "Fixed Yield" && (
              <div className="mt-2 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                Pendle-style maturity market. Compare fixed yield with the floating APY before routing capital.
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.035)] px-3 py-3 sm:grid-cols-3 md:bg-transparent md:px-0 md:py-0">
          <div>
            <div className="text-[10px] uppercase text-[var(--color-text-dim)]">{getRateTitle(opp)}</div>
            <div className="mt-1 text-[16px] font-bold text-[var(--color-positive)]">
              {getRateLabel(opp)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--color-text-dim)]">TVL</div>
            <div className="mt-1 font-mono text-[13px] font-semibold text-[var(--color-text-secondary)]">
              {formatUsd(opp.tvl)}
            </div>
          </div>
          <div className="text-right">
            {externalUrl ? (
              <>
                <div className="text-[10px] uppercase text-[var(--color-text-dim)]">View</div>
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center justify-end text-[12px] font-bold text-[var(--color-accent-primary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  {isPendleOpportunity(opp) ? "Trade" : "Open"}
                </a>
              </>
            ) : (
              <>
                <div className="text-[10px] uppercase text-[var(--color-text-dim)]">Link</div>
                <div className="mt-1 text-[13px] text-[var(--color-text-dim)]">-</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PendleSpotlight({ opportunities }: { opportunities: YieldOpportunity[] }) {
  const pendleOpps = opportunities.filter(isPendleOpportunity);
  const totalTvl = pendleOpps.reduce((sum, opp) => sum + Math.max(opp.tvl, 0), 0);
  const topFixed = [...pendleOpps].sort((a, b) => b.apr - a.apr)[0];

  if (pendleOpps.length === 0) return null;

  return (
    <section className="mb-5 rounded-[var(--radius-lg)] border border-[rgba(255,184,0,0.28)] bg-[rgba(255,184,0,0.055)] px-4 py-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning">New on Monad</Badge>
            <span className="text-[13px] font-bold text-[var(--color-text-primary)]">
              Pendle fixed-yield markets
            </span>
          </div>
          <p className="mt-2 max-w-[720px] text-[12px] leading-relaxed text-[var(--color-text-muted)]">
            Pendle rows are maturity-based yield markets, so they sit beside lending and vault APYs but should be compared separately.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(0,0,0,0.12)] px-3 py-2">
            <div className="text-[9px] uppercase text-[var(--color-text-dim)]">Markets</div>
            <div className="mt-1 font-mono text-[13px] font-bold text-[var(--color-text-primary)]">{pendleOpps.length}</div>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(0,0,0,0.12)] px-3 py-2">
            <div className="text-[9px] uppercase text-[var(--color-text-dim)]">Top fixed</div>
            <div className="mt-1 font-mono text-[13px] font-bold text-[var(--color-positive)]">
              {topFixed ? getRateLabel(topFixed) : "-"}
            </div>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(0,0,0,0.12)] px-3 py-2">
            <div className="text-[9px] uppercase text-[var(--color-text-dim)]">TVL</div>
            <div className="mt-1 font-mono text-[13px] font-bold text-[var(--color-text-primary)]">{formatUsd(totalTvl)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LoopStrategyRow({ strategy }: { strategy: LoopStrategy }) {
  const riskTone = {
    low: "positive",
    medium: "warning",
    high: "danger",
  } as const;
  const externalUrl = getExternalUrl(strategy.depositUrl);
  const content = (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-bold text-[var(--color-text-primary)]">
            Supply {strategy.supplyToken} / Borrow {strategy.borrowToken}
          </span>
          <Badge tone={riskTone[strategy.liquidationRisk]}>{strategy.liquidationRisk} risk</Badge>
        </div>
        <div className="mt-2 grid gap-1 text-[12px] text-[var(--color-text-muted)] md:grid-cols-2">
          <span>
            Supply on <span className="text-[var(--color-text-secondary)]">{strategy.supplyProtocol}</span>{" "}
            displayed APR{" "}
            <span className="text-[var(--color-positive)]">{formatRateLabel(strategy.supplyApr)}</span>
          </span>
          <span>
            Borrow on <span className="text-[var(--color-text-secondary)]">{strategy.borrowProtocol}</span>{" "}
            {strategy.borrowApr > 0 && (
              <span className="text-[var(--color-accent-secondary)]">+{formatRateLabel(strategy.borrowApr)} incentive</span>
            )}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.035)] px-3 py-3 text-right sm:grid-cols-4">
        <div>
          <div className="text-[10px] text-[var(--color-text-dim)]">Est. 1x</div>
          <div className="font-semibold text-[var(--color-text-primary)]">{formatRateLabel(strategy.netAprAt1x)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--color-text-dim)]">Est. 2x</div>
          <div className="font-semibold text-[var(--color-positive)]">{formatRateLabel(strategy.netAprAt2x)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--color-text-dim)]">Est. 3x</div>
          <div className="font-semibold text-[var(--color-positive)]">{formatRateLabel(strategy.netAprAt3x)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--color-text-dim)]">Max</div>
          <div className="font-semibold text-[var(--color-text-secondary)]">{strategy.maxLeverage}x</div>
        </div>
      </div>
    </div>
  );

  if (!externalUrl) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4 transition-all hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-card-hover)]">
        {content}
      </div>
    );
  }

  return (
    <a
      href={externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4 transition-all hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-card-hover)]"
    >
      {content}
    </a>
  );
}

function EmptyOpportunities({
  label,
  onPickToken,
}: {
  label: string;
  onPickToken?: (symbol: string) => void;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-8 text-center">
      <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{label}</p>
      {onPickToken && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SUGGESTED_TOKENS.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => onPickToken(symbol)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
            >
              Try {symbol}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OpportunitySection({
  title,
  subtitle,
  emptyLabel,
  opportunities,
  onPickToken,
}: {
  title: string;
  subtitle: string;
  emptyLabel: string;
  opportunities: YieldOpportunity[];
  onPickToken?: (symbol: string) => void;
}) {
  return (
    <section className="flex-1">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]">{title}</h2>
          <p className="mt-1 text-[11px] text-[var(--color-text-dim)]">{subtitle}</p>
        </div>
        <Badge>{opportunities.length}</Badge>
      </div>
      <div className="space-y-2 md:max-h-[620px] md:overflow-y-auto md:pr-1">
        {opportunities.slice(0, 30).map((opp, index) => (
          <div key={`${opp.id}-${index}`} style={{ animationDelay: `${index * 25}ms` }} className="animate-fade-up">
            <OpportunityRow opp={opp} />
          </div>
        ))}
        {opportunities.length === 0 && (
          <EmptyOpportunities label={emptyLabel} onPickToken={onPickToken} />
        )}
      </div>
    </section>
  );
}

function AggregatorSkeleton() {
  return (
    <div>
      <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4">
        <div className="h-4 w-52 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
        <div className="mt-3 h-3 w-full max-w-[560px] animate-pulse rounded bg-[rgba(255,255,255,0.05)]" />
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
            <div className="h-4 w-28 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
            <div className="mt-4 flex flex-wrap gap-2">
              {Array.from({ length: 10 }).map((__, tokenIndex) => (
                <div key={tokenIndex} className="h-8 w-16 animate-pulse rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.06)]" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, sectionIndex) => (
          <div key={sectionIndex} className="space-y-2">
            {Array.from({ length: 5 }).map((__, rowIndex) => (
              <div key={rowIndex} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 animate-pulse rounded-full bg-[rgba(255,255,255,0.08)]" />
                  <div className="flex-1">
                    <div className="h-4 w-28 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
                    <div className="mt-2 h-3 w-44 animate-pulse rounded bg-[rgba(255,255,255,0.05)]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function YieldAggregator() {
  const [allOpps, setAllOpps] = useState<YieldOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataStatus, setDataStatus] = useState<{
    cacheStatus?: string;
    fetchedAt?: number;
  }>({});
  const [lendTokens, setLendTokens] = useState<string[]>([]);
  const [borrowTokens, setBorrowTokens] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>("apr");
  const [protocolFilter, setProtocolFilter] = useState("all");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lendParam = params.get("lend");
    if (lendParam) {
      setLendTokens([lendParam]);
    }

    fetchYieldOpportunitiesWithClientMeta()
      .then((result) => {
        setAllOpps(result.data);
        setDataStatus({
          cacheStatus: result.cacheStatus,
          fetchedAt: result.fetchedAt || Date.now(),
        });
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        setError("Rate data is temporarily unavailable.");
        setLoading(false);
      });
  }, []);

  function selectToken(list: string[], setList: (value: string[]) => void, symbol: string) {
    setList(list.includes(symbol) ? [] : [symbol]);
  }

  const hasLendSelection = lendTokens.length > 0;
  const hasBorrowSelection = borrowTokens.length > 0;
  const showSupplyOnly = hasLendSelection && !hasBorrowSelection;
  const showBorrowOnly = hasBorrowSelection && !hasLendSelection;
  const showLooping = hasLendSelection && hasBorrowSelection;
  const baseLendOpps = filterByTokens(allOpps, lendTokens, "LEND");
  const baseBorrowOpps = filterBorrowOpportunities(allOpps, borrowTokens, showLooping ? lendTokens : []);
  const protocolCounts = new Map<string, { label: string; count: number }>();
  const protocolSource = showSupplyOnly
    ? baseLendOpps
    : showBorrowOnly
      ? baseBorrowOpps
      : [...baseLendOpps, ...baseBorrowOpps];
  protocolSource.forEach((opp) => {
    const key = protocolFilterKey(opp.protocol);
    const existing = protocolCounts.get(key);
    protocolCounts.set(key, {
      label: preferredProtocolLabel(existing?.label, opp.protocol),
      count: (existing?.count || 0) + 1,
    });
  });
  const protocolOptions = [...protocolCounts.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 30);
  const activeProtocol = protocolFilter === "all" || protocolCounts.has(protocolFilter) ? protocolFilter : "all";
  const filterByProtocol = (opps: YieldOpportunity[]) =>
    activeProtocol === "all"
      ? opps
      : opps.filter((opp) => protocolFilterKey(opp.protocol) === activeProtocol);
  const lendOpps = sortOpportunities(filterByProtocol(baseLendOpps), sortField);
  const borrowOpps = sortOpportunities(filterByProtocol(baseBorrowOpps), sortField);
  const baseLoopStrategies = showLooping
    ? calculateLoopStrategies(allOpps, lendTokens, borrowTokens)
    : [];
  const loopStrategies = activeProtocol === "all"
    ? baseLoopStrategies
    : baseLoopStrategies.filter(
        (strategy) =>
          protocolFilterKey(strategy.supplyProtocol) === activeProtocol ||
          protocolFilterKey(strategy.borrowProtocol) === activeProtocol
      );
  if (loading) return <AggregatorSkeleton />;

  if (error) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-8 text-center">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{error}</p>
        <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
          Please try again in a moment.
        </p>
      </div>
    );
  }

  return (
    <div>
      <RateExplainerStrip />

      {dataStatus.fetchedAt && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-dim)]">
          <span>
            Rates updated {new Date(dataStatus.fetchedAt).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {dataStatus.cacheStatus === "stale" && (
            <>
              <span>·</span>
              <span>Using cached rates</span>
            </>
          )}
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <TokenSelectorPanel
          title="Supply / Deposit"
          subtitle="Lending, staking, LP, and vaults."
          tone="positive"
          tokens={POPULAR_TOKENS}
          selectedTokens={lendTokens}
          onSelect={(symbol) => selectToken(lendTokens, setLendTokens, symbol)}
        />
        <TokenSelectorPanel
          title="Borrow"
          subtitle="Borrow markets and collateral hints."
          tone="blue"
          tokens={POPULAR_TOKENS}
          selectedTokens={borrowTokens}
          onSelect={(symbol) => selectToken(borrowTokens, setBorrowTokens, symbol)}
        />
      </div>

      <PendleSpotlight opportunities={allOpps} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold uppercase text-[var(--color-text-dim)]">
            Sort by
          </span>
          <SortButton label="Displayed APR" field="apr" current={sortField} onClick={setSortField} />
          <SortButton label="TVL" field="tvl" current={sortField} onClick={setSortField} />
        </div>
        <ProtocolFilter
          options={protocolOptions}
          selected={activeProtocol}
          onSelect={setProtocolFilter}
        />
      </div>

      {!hasLendSelection && !hasBorrowSelection && (
        <div className="grid gap-6 md:grid-cols-2">
          <OpportunitySection
            title="Supply / Deposit Opportunities"
            subtitle="Lending, staking, LP, and vault rows."
            emptyLabel="No supply or deposit opportunities found."
            opportunities={lendOpps}
            onPickToken={(symbol) => setLendTokens([symbol])}
          />
          <OpportunitySection
            title="Borrow Markets"
            subtitle="Borrow rows include collateral hints where available."
            emptyLabel="No borrow markets found."
            opportunities={borrowOpps}
            onPickToken={(symbol) => setBorrowTokens([symbol])}
          />
        </div>
      )}

      {showSupplyOnly && (
        <OpportunitySection
          title={`Supply / deposit opportunities for ${lendTokens.join(", ")}`}
          subtitle="Matching supply and deposit rows."
          emptyLabel="No supply or deposit opportunities found for this token."
          opportunities={lendOpps}
          onPickToken={(symbol) => setLendTokens([symbol])}
        />
      )}

      {showBorrowOnly && (
        <OpportunitySection
          title={`Borrow markets for ${borrowTokens.join(", ")}`}
          subtitle="Collateral hints shown where available."
          emptyLabel="No borrow markets found."
          opportunities={borrowOpps}
          onPickToken={(symbol) => setBorrowTokens([symbol])}
        />
      )}

      {showLooping && (
        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]">
                Loop Scenarios
              </h2>
              <p className="mt-1 text-[11px] text-[var(--color-text-dim)]">
                {lendTokens.join(", ")} supplied, {borrowTokens.join(", ")} borrowed.
              </p>
            </div>
            <Badge tone="positive">{loopStrategies.length}</Badge>
          </div>
          <div className="space-y-2">
            {loopStrategies.map((strategy, index) => (
              <div
                key={`${strategy.supplyProtocol}-${strategy.borrowProtocol}-${strategy.supplyToken}-${strategy.borrowToken}-${index}`}
                className="animate-fade-up"
                style={{ animationDelay: `${index * 25}ms` }}
              >
                <LoopStrategyRow strategy={strategy} />
              </div>
            ))}
            {loopStrategies.length === 0 && (
              <EmptyOpportunities
                label="No loop scenarios available for this combination."
                onPickToken={(symbol) => setLendTokens([symbol])}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
