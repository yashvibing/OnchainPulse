import type { TokenBalance } from "@/services/tokens";
import {
  filterByTokens,
  getOpportunityAssetSymbols,
  sortOpportunities,
  type YieldOpportunity,
} from "@/services/yields-aggregator";

export interface WalletYieldMatch {
  symbol: string;
  walletSymbol: string;
  balanceLabel: string;
  valueUsd: number;
  estimatedDailyUsd: number;
  opportunity: YieldOpportunity;
}

export function normalizeWalletYieldSymbol(symbol: string) {
  const upper = symbol.toUpperCase();
  if (upper === "MON") return "WMON";
  if (upper === "SHMON") return "shMON";
  if (upper === "APRMON") return "aprMON";
  if (upper === "SMON") return "sMON";
  if (upper === "GMON") return "gMON";
  if (upper === "CBBTC") return "cbBTC";
  return upper;
}

export function getHeldYieldSymbols(tokens: TokenBalance[]) {
  return [
    ...new Set(
      tokens
        .filter((token) => token.valueUsd > 0)
        .map((token) => normalizeWalletYieldSymbol(token.token.symbol))
    ),
  ];
}

export function buildWalletYieldMatches(
  tokens: TokenBalance[],
  opportunities: YieldOpportunity[]
): WalletYieldMatch[] {
  const matches: WalletYieldMatch[] = [];

  for (const token of tokens) {
    if (token.valueUsd <= 0) continue;

    const symbol = normalizeWalletYieldSymbol(token.token.symbol);
    const lendingOpps = sortOpportunities(
      filterByTokens(opportunities, [symbol], "LEND").filter((opp) => {
        const assets = getOpportunityAssetSymbols(opp);
        return opp.apr > 0 && assets.length > 0 && opp.opportunityType !== "LP";
      }),
      "apr"
    );
    const best = lendingOpps[0];
    if (!best) continue;

    matches.push({
      symbol,
      walletSymbol: token.token.symbol,
      balanceLabel: `${Number.parseFloat(token.formatted).toLocaleString(undefined, {
        maximumFractionDigits: 4,
      })} ${token.token.symbol}`,
      valueUsd: token.valueUsd,
      estimatedDailyUsd: (token.valueUsd * best.apr) / 36500,
      opportunity: best,
    });
  }

  return matches.sort((a, b) => b.estimatedDailyUsd - a.estimatedDailyUsd);
}
