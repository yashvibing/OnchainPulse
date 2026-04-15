"use client";

import { useState, useEffect } from "react";
import {
  fetchYieldOpportunities,
  filterByTokens,
  sortOpportunities,
  calculateLoopStrategies,
  type YieldOpportunity,
  type LoopStrategy,
  type SortField,
} from "@/services/yields-aggregator";
import { formatNumber } from "@/lib/format";

const POPULAR_TOKENS = ["WMON", "USDC", "USDT0", "WETH", "AUSD", "shMON", "aprMON", "sMON", "gMON", "WBTC", "cbBTC", "USD1"];

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
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[12px] font-medium transition-all ${
        selected
          ? "bg-[var(--color-accent-primary)] text-[#0A0E17]"
          : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-secondary)]"
      }`}
    >
      {symbol}
    </button>
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
  onClick: (f: SortField) => void;
}) {
  return (
    <button
      onClick={() => onClick(field)}
      className={`text-[11px] font-medium transition-colors ${
        current === field
          ? "text-[var(--color-accent-primary)]"
          : "text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)]"
      }`}
    >
      {label}
    </button>
  );
}

function OpportunityRow({ opp }: { opp: YieldOpportunity }) {
  return (
    <a
      href={opp.depositUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="animate-fade-up flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 transition-all hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-card-hover)]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex -space-x-1.5">
          {opp.tokens.slice(0, 2).map((t, i) => (
            <div
              key={i}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--color-bg-primary)] text-[8px] font-bold text-white"
              style={{ background: "#5A5A74", zIndex: 2 - i }}
            >
              {t.symbol.slice(0, 2)}
            </div>
          ))}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
              {opp.tokens.map((t) => t.symbol).join(" / ")}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
              opp.action === "LEND"
                ? "bg-[rgba(0,232,123,0.1)] text-[var(--color-positive)]"
                : "bg-[rgba(59,130,246,0.1)] text-[var(--color-accent-secondary)]"
            }`}>
              {opp.action}
            </span>
          </div>
          <div className="text-[11px] text-[var(--color-text-dim)] truncate">
            {opp.protocol}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 shrink-0">
        <div className="text-right">
          <div className="text-[14px] font-semibold text-[var(--color-positive)]">
            {opp.apr.toFixed(2)}%
          </div>
          <div className="text-[10px] text-[var(--color-text-dim)]">APR</div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-[13px] font-mono text-[var(--color-text-secondary)]">
            ${formatNumber(opp.tvl, 0)}
          </div>
          <div className="text-[10px] text-[var(--color-text-dim)]">TVL</div>
        </div>
        <div className="text-[var(--color-text-dim)]">→</div>
      </div>
    </a>
  );
}

function LoopStrategyRow({ s }: { s: LoopStrategy }) {
  const riskColors = {
    low: "text-[var(--color-positive)] bg-[rgba(0,232,123,0.1)]",
    medium: "text-[var(--color-warning)] bg-[rgba(255,184,0,0.1)]",
    high: "text-[var(--color-negative)] bg-[rgba(255,71,87,0.1)]",
  };

  return (
    <a
      href={s.depositUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="animate-fade-up rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 transition-all hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-card-hover)] block"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
            Supply {s.supplyToken} → Borrow {s.borrowToken}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${riskColors[s.liquidationRisk]}`}>
            {s.liquidationRisk} risk
          </span>
        </div>
        <div className="text-[var(--color-text-dim)]">→</div>
      </div>
      <div className="flex items-center gap-4 text-[12px]">
        <div>
          <span className="text-[var(--color-text-dim)]">Supply on </span>
          <span className="text-[var(--color-text-secondary)]">{s.supplyProtocol}</span>
          <span className="text-[var(--color-positive)] ml-1">{s.supplyApr.toFixed(2)}%</span>
        </div>
        <div>
          <span className="text-[var(--color-text-dim)]">Borrow on </span>
          <span className="text-[var(--color-text-secondary)]">{s.borrowProtocol}</span>
          {s.borrowApr > 0 && <span className="text-[var(--color-accent-secondary)] ml-1">+{s.borrowApr.toFixed(2)}% incentive</span>}
        </div>
      </div>
      <div className="mt-2 flex gap-4 text-[11px]">
        <div>
          <span className="text-[var(--color-text-dim)]">1x: </span>
          <span className="font-semibold text-[var(--color-text-primary)]">{s.netAprAt1x.toFixed(2)}%</span>
        </div>
        <div>
          <span className="text-[var(--color-text-dim)]">2x: </span>
          <span className="font-semibold text-[var(--color-positive)]">{s.netAprAt2x.toFixed(2)}%</span>
        </div>
        <div>
          <span className="text-[var(--color-text-dim)]">3x: </span>
          <span className="font-semibold text-[var(--color-positive)]">{s.netAprAt3x.toFixed(2)}%</span>
        </div>
        <div className="ml-auto">
          <span className="text-[var(--color-text-dim)]">Max leverage: </span>
          <span className="text-[var(--color-text-secondary)]">{s.maxLeverage}x</span>
        </div>
      </div>
    </a>
  );
}

export function YieldAggregator() {
  const [allOpps, setAllOpps] = useState<YieldOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [lendTokens, setLendTokens] = useState<string[]>([]);
  const [borrowTokens, setBorrowTokens] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>("apr");

  useEffect(() => {
    fetchYieldOpportunities().then((data) => {
      setAllOpps(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function toggleToken(list: string[], setList: (v: string[]) => void, symbol: string) {
    if (list.includes(symbol)) setList(list.filter((s) => s !== symbol));
    else setList([...list, symbol]);
  }

  const lendOpps = sortOpportunities(filterByTokens(allOpps, lendTokens, "LEND"), sortField);
  const borrowOpps = sortOpportunities(filterByTokens(allOpps, borrowTokens, "BORROW"), sortField);
  const showLooping = lendTokens.length > 0 && borrowTokens.length > 0;
  const loopStrategies = showLooping ? calculateLoopStrategies(allOpps, lendTokens, borrowTokens) : [];

  if (loading) {
    return (
      <div className="py-10 text-center text-[13px] text-[var(--color-text-muted)]">
        Loading yield data from Merkl...
      </div>
    );
  }

  return (
    <div>
      {/* Token selectors */}
      <div className="flex flex-col md:flex-row gap-6 mb-6">
        {/* Lend tokens */}
        <div className="flex-1">
          <div className="mb-2 text-[12px] font-semibold text-[var(--color-positive)]">
            LEND — Select tokens to supply
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_TOKENS.map((s) => (
              <TokenChip
                key={s}
                symbol={s}
                selected={lendTokens.includes(s)}
                onClick={() => toggleToken(lendTokens, setLendTokens, s)}
              />
            ))}
          </div>
        </div>

        {/* Borrow tokens */}
        <div className="flex-1">
          <div className="mb-2 text-[12px] font-semibold text-[var(--color-accent-secondary)]">
            BORROW — Select tokens to borrow
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_TOKENS.map((s) => (
              <TokenChip
                key={s}
                symbol={s}
                selected={borrowTokens.includes(s)}
                onClick={() => toggleToken(borrowTokens, setBorrowTokens, s)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Sort controls */}
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[11px] text-[var(--color-text-dim)]">Sort by:</span>
        <SortButton label="APR" field="apr" current={sortField} onClick={setSortField} />
        <SortButton label="TVL" field="tvl" current={sortField} onClick={setSortField} />
        <SortButton label="Rewards" field="dailyRewards" current={sortField} onClick={setSortField} />
        <SortButton label="Protocol" field="protocol" current={sortField} onClick={setSortField} />
      </div>

      {/* Results */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Lend results */}
        <div className="flex-1">
          <div className="mb-2 text-[11px] text-[var(--color-text-dim)]">
            {lendOpps.length} lending opportunities {lendTokens.length > 0 ? `for ${lendTokens.join(", ")}` : "(all tokens)"}
          </div>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {lendOpps.slice(0, 25).map((o, i) => (
              <div key={`${o.id}-${i}`} style={{ animationDelay: `${i * 30}ms` }}>
                <OpportunityRow opp={o} />
              </div>
            ))}
            {lendOpps.length === 0 && (
              <div className="py-6 text-center text-[12px] text-[var(--color-text-dim)]">
                No lending opportunities found
              </div>
            )}
          </div>
        </div>

        {/* Borrow results */}
        <div className="flex-1">
          <div className="mb-2 text-[11px] text-[var(--color-text-dim)]">
            {borrowOpps.length} borrowing opportunities {borrowTokens.length > 0 ? `for ${borrowTokens.join(", ")}` : "(all tokens)"}
          </div>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {borrowOpps.slice(0, 25).map((o, i) => (
              <div key={`${o.id}-${i}`} style={{ animationDelay: `${i * 30}ms` }}>
                <OpportunityRow opp={o} />
              </div>
            ))}
            {borrowOpps.length === 0 && (
              <div className="py-6 text-center text-[12px] text-[var(--color-text-dim)]">
                {borrowTokens.length > 0 ? "No borrowing opportunities found" : "Select borrow tokens to see rates"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Looping strategies — shown when both lend + borrow tokens selected */}
      {showLooping && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[15px] font-bold text-[var(--color-text-primary)]">Loop Strategies</span>
            <span className="rounded-full bg-[rgba(0,232,123,0.1)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-positive)]">
              {loopStrategies.length}
            </span>
          </div>
          <div className="mb-2 text-[11px] text-[var(--color-text-dim)]">
            Supply → borrow → re-supply loop. APR shown at 1x, 2x, 3x leverage. Does not include base borrow cost.
          </div>
          <div className="space-y-1.5">
            {loopStrategies.map((s, i) => (
              <div key={`${s.supplyProtocol}-${s.borrowProtocol}-${s.supplyToken}-${s.borrowToken}-${i}`} style={{ animationDelay: `${i * 30}ms` }}>
                <LoopStrategyRow s={s} />
              </div>
            ))}
            {loopStrategies.length === 0 && (
              <div className="py-6 text-center text-[12px] text-[var(--color-text-dim)]">
                No loop strategies available for this combination
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
