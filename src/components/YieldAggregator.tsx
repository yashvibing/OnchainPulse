"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  useTokenBalances,
} from "@/hooks/usePortfolio";
import {
  calculateLoopStrategies,
  fetchYieldOpportunities,
  filterBorrowOpportunities,
  filterByTokens,
  getBorrowCollateralSymbols,
  getOpportunityAssetSymbols,
  sortOpportunities,
  type LoopStrategy,
  type SortField,
  type YieldOpportunity,
} from "@/services/yields-aggregator";
import { formatNumber, isValidEvmAddress, shortenAddress } from "@/lib/format";
import {
  buildWalletYieldMatches,
  getHeldYieldSymbols,
} from "@/lib/walletOpportunities";
import { getLastAddress, saveAddress } from "@/lib/savedAddresses";

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

function formatUsd(value: number) {
  if (value >= 1_000_000_000) return `$${formatNumber(value / 1_000_000_000, 2)}B`;
  if (value >= 1_000_000) return `$${formatNumber(value / 1_000_000, 2)}M`;
  if (value >= 1_000) return `$${formatNumber(value / 1_000, 1)}K`;
  return `$${formatNumber(value, 0)}`;
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
    positive: "bg-[rgba(0,232,123,0.1)] text-[var(--color-positive)]",
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
  const initials = opp.protocol
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className="h-8 w-8 shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.06)] bg-cover bg-center"
      style={opp.protocolIcon ? { backgroundImage: `url(${opp.protocolIcon})` } : undefined}
      aria-hidden="true"
    >
      {!opp.protocolIcon && (
        <div className="flex h-full w-full items-center justify-center text-[9px] font-bold text-[var(--color-text-secondary)]">
          {initials || "P"}
        </div>
      )}
    </div>
  );
}

function AssetStack({ symbols }: { symbols: string[] }) {
  const visibleSymbols = symbols.length > 0 ? symbols.slice(0, 3) : ["?"];

  return (
    <div className="flex -space-x-2">
      {visibleSymbols.map((symbol, index) => (
        <div
          key={`${symbol}-${index}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--color-bg-primary)] bg-[rgba(0,232,123,0.14)] text-[9px] font-extrabold text-[var(--color-positive)]"
          style={{ zIndex: visibleSymbols.length - index }}
        >
          {symbol.slice(0, 2).toUpperCase()}
        </div>
      ))}
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
          ? "border-[var(--color-accent-primary)] bg-[rgba(0,232,123,0.12)] text-[var(--color-positive)] shadow-[0_0_0_1px_rgba(0,232,123,0.08)]"
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

function WalletHoldingsPanel({
  address,
  input,
  onInputChange,
  onLoad,
  onUseBest,
  onPick,
  loading,
  heldSymbols,
  matches,
}: {
  address: string;
  input: string;
  onInputChange: (value: string) => void;
  onLoad: () => void;
  onUseBest: () => void;
  onPick: (symbol: string) => void;
  loading: boolean;
  heldSymbols: string[];
  matches: ReturnType<typeof buildWalletYieldMatches>;
}) {
  return (
    <section className="mb-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <div className="text-[12px] font-bold uppercase text-[var(--color-text-secondary)]">
            Use My Holdings
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            Paste an address to match strategy tokens against assets already in that wallet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && onLoad()}
            placeholder="0x wallet address"
            className="min-w-[240px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-2 font-mono text-[12px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-primary)]"
          />
          <button
            type="button"
            onClick={onLoad}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
          >
            Load
          </button>
        </div>
      </div>

      {address && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="font-mono text-[11px] text-[var(--color-text-dim)]">
              Wallet {shortenAddress(address)}
            </div>
            <button
              type="button"
              onClick={onUseBest}
              disabled={matches.length === 0}
              className="rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-3 py-2 text-[12px] font-bold text-[#07110C] transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
            >
              Use best holding
            </button>
          </div>
          {loading ? (
            <div className="text-[12px] text-[var(--color-text-muted)]">Loading wallet holdings...</div>
          ) : heldSymbols.length === 0 ? (
            <div className="text-[12px] text-[var(--color-text-muted)]">
              No supported yield tokens found in this wallet.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {heldSymbols.map((symbol) => {
                const hasMatch = matches.some((match) => match.symbol === symbol);
                return (
                  <button
                    key={symbol}
                    type="button"
                    onClick={() => onPick(symbol)}
                    disabled={!hasMatch}
                    className={`rounded-[var(--radius-md)] border px-3 py-2 text-[12px] font-semibold transition-colors ${
                      hasMatch
                        ? "border-[var(--color-accent-primary)] bg-[rgba(0,232,123,0.08)] text-[var(--color-positive)] hover:bg-[rgba(0,232,123,0.12)]"
                        : "border-[var(--color-border)] text-[var(--color-text-dim)] opacity-60"
                    }`}
                  >
                    {symbol}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
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
          ? "border-[var(--color-accent-primary)] bg-[rgba(0,232,123,0.1)] text-[var(--color-positive)]"
          : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      {label}
    </button>
  );
}

function OpportunityRow({ opp }: { opp: YieldOpportunity }) {
  const assetSymbols = getOpportunityAssetSymbols(opp);
  const collateralSymbols = getBorrowCollateralSymbols(opp);
  const tokenLabel =
    assetSymbols.length > 0 ? assetSymbols.join(" / ") : opp.tokens.map((token) => token.symbol).join(" / ");
  const type = opp.opportunityType || (opp.action === "BORROW" ? "Borrow" : "Lending");

  return (
    <a
      href={opp.depositUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4 transition-all hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-card-hover)]"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
        <div className="flex min-w-0 gap-3">
          <AssetStack symbols={assetSymbols} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-[14px] font-bold text-[var(--color-text-primary)]">
                {tokenLabel}
              </span>
              <Badge tone={opp.action === "LEND" ? "positive" : "blue"}>{opp.action === "LEND" ? "Lend" : "Borrow"}</Badge>
              <Badge tone={opp.source === "DefiLlama" ? "violet" : opp.source === "Both" ? "neutral" : "positive"}>
                {opp.source}
              </Badge>
              {!["Lending", "Borrow"].includes(type) && <Badge tone="violet">{type}</Badge>}
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
                Lend/collateral: {collateralSymbols.join(", ")}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.035)] px-3 py-3 md:bg-transparent md:px-0 md:py-0">
          <div>
            <div className="text-[10px] uppercase text-[var(--color-text-dim)]">APR</div>
            <div className="mt-1 text-[16px] font-bold text-[var(--color-positive)]">
              {opp.apr.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--color-text-dim)]">TVL</div>
            <div className="mt-1 font-mono text-[13px] font-semibold text-[var(--color-text-secondary)]">
              {formatUsd(opp.tvl)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-[var(--color-text-dim)]">Open</div>
            <div className="mt-1 text-[15px] text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-text-primary)]">
              &gt;
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

function LoopStrategyRow({ strategy }: { strategy: LoopStrategy }) {
  const riskTone = {
    low: "positive",
    medium: "warning",
    high: "danger",
  } as const;

  return (
    <a
      href={strategy.depositUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4 transition-all hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-card-hover)]"
    >
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
              <span className="text-[var(--color-positive)]">{strategy.supplyApr.toFixed(2)}%</span>
            </span>
            <span>
              Borrow on <span className="text-[var(--color-text-secondary)]">{strategy.borrowProtocol}</span>{" "}
              {strategy.borrowApr > 0 && (
                <span className="text-[var(--color-accent-secondary)]">+{strategy.borrowApr.toFixed(2)}% incentive</span>
              )}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.035)] px-3 py-3 text-right">
          <div>
            <div className="text-[10px] text-[var(--color-text-dim)]">1x</div>
            <div className="font-semibold text-[var(--color-text-primary)]">{strategy.netAprAt1x.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-dim)]">2x</div>
            <div className="font-semibold text-[var(--color-positive)]">{strategy.netAprAt2x.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-dim)]">3x</div>
            <div className="font-semibold text-[var(--color-positive)]">{strategy.netAprAt3x.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-dim)]">Max</div>
            <div className="font-semibold text-[var(--color-text-secondary)]">{strategy.maxLeverage}x</div>
          </div>
        </div>
      </div>
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
  const [lendTokens, setLendTokens] = useState<string[]>([]);
  const [borrowTokens, setBorrowTokens] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>("apr");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletInput, setWalletInput] = useState("");
  const walletBalances = useTokenBalances(walletAddress || null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addressParam = params.get("address") || getLastAddress();
    const lendParam = params.get("lend");
    if (addressParam && isValidEvmAddress(addressParam)) {
      setWalletAddress(addressParam);
      setWalletInput(addressParam);
    }
    if (lendParam) {
      setLendTokens([lendParam]);
    }

    fetchYieldOpportunities()
      .then((data) => {
        setAllOpps(data);
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        setError("Yield data is temporarily unavailable.");
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
  const lendOpps = sortOpportunities(filterByTokens(allOpps, lendTokens, "LEND"), sortField);
  const borrowOpps = sortOpportunities(
    filterBorrowOpportunities(allOpps, borrowTokens, showLooping ? lendTokens : []),
    sortField
  );
  const loopStrategies = showLooping
    ? calculateLoopStrategies(allOpps, lendTokens, borrowTokens)
    : [];
  const walletTokens = walletBalances.data || [];
  const walletMatches = buildWalletYieldMatches(walletTokens, allOpps);
  const heldYieldSymbols = getHeldYieldSymbols(walletTokens);

  function loadWalletHoldings() {
    const nextAddress = walletInput.trim();
    if (!isValidEvmAddress(nextAddress)) return;
    saveAddress(nextAddress);
    setWalletAddress(nextAddress);
    const params = new URLSearchParams(window.location.search);
    params.set("address", nextAddress);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", nextUrl);
  }

  function useBestHolding() {
    const best = walletMatches[0];
    if (!best) return;
    setLendTokens([best.symbol]);
    setBorrowTokens([]);
  }

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
      <WalletHoldingsPanel
        address={walletAddress}
        input={walletInput}
        onInputChange={setWalletInput}
        onLoad={loadWalletHoldings}
        onUseBest={useBestHolding}
        onPick={(symbol) => {
          setLendTokens([symbol]);
          setBorrowTokens([]);
        }}
        loading={walletBalances.isLoading}
        heldSymbols={heldYieldSymbols}
        matches={walletMatches}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <TokenSelectorPanel
          title="Lend"
          subtitle="Pick one asset to see direct supply APRs."
          tone="positive"
          tokens={POPULAR_TOKENS}
          selectedTokens={lendTokens}
          onSelect={(symbol) => selectToken(lendTokens, setLendTokens, symbol)}
        />
        <TokenSelectorPanel
          title="Borrow"
          subtitle="Pick one asset to see borrow markets and required collateral."
          tone="blue"
          tokens={POPULAR_TOKENS}
          selectedTokens={borrowTokens}
          onSelect={(symbol) => selectToken(borrowTokens, setBorrowTokens, symbol)}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-semibold uppercase text-[var(--color-text-dim)]">
          Sort by
        </span>
        <SortButton label="APR" field="apr" current={sortField} onClick={setSortField} />
        <SortButton label="TVL" field="tvl" current={sortField} onClick={setSortField} />
        <SortButton label="Rewards" field="dailyRewards" current={sortField} onClick={setSortField} />
        <SortButton label="Protocol" field="protocol" current={sortField} onClick={setSortField} />
      </div>

      {!hasLendSelection && !hasBorrowSelection && (
        <div className="grid gap-6 md:grid-cols-2">
          <OpportunitySection
            title="Lending APRs"
            subtitle="All supported Monad supply opportunities."
            emptyLabel="No lending opportunities found."
            opportunities={lendOpps}
            onPickToken={(symbol) => setLendTokens([symbol])}
          />
          <OpportunitySection
            title="Borrow Markets"
            subtitle="Borrow rows include collateral hints where available."
            emptyLabel="No borrowing opportunities found."
            opportunities={borrowOpps}
            onPickToken={(symbol) => setBorrowTokens([symbol])}
          />
        </div>
      )}

      {showSupplyOnly && (
        <OpportunitySection
          title={`Lending APRs for ${lendTokens.join(", ")}`}
          subtitle="Direct supply opportunities from Merkl and DefiLlama."
          emptyLabel="No lending opportunities found for this token."
          opportunities={lendOpps}
          onPickToken={(symbol) => setLendTokens([symbol])}
        />
      )}

      {showBorrowOnly && (
        <OpportunitySection
          title={`Borrow markets for ${borrowTokens.join(", ")}`}
          subtitle="Borrow opportunities show which collateral can be needed."
          emptyLabel="No borrow opportunities found for this token."
          opportunities={borrowOpps}
          onPickToken={(symbol) => setBorrowTokens([symbol])}
        />
      )}

      {showLooping && (
        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]">
                Loop Strategies
              </h2>
              <p className="mt-1 text-[11px] text-[var(--color-text-dim)]">
                Lending {lendTokens.join(", ")} and borrowing {borrowTokens.join(", ")}. APR does not include unknown base borrow cost.
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
                label="No loop strategies available for this combination."
                onPickToken={(symbol) => setLendTokens([symbol])}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
