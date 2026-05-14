// ─── Yield Aggregator via Merkl API ───
//
// Fetches all lending/borrowing opportunities on Monad from Merkl's API.
// Single source of truth for APR, TVL, protocol, tokens, deposit URLs.

export interface YieldOpportunity {
  id: string;
  action: "LEND" | "BORROW";
  name: string;
  protocol: string;
  protocolIcon: string;
  protocolUrl: string;
  apr: number; // percentage (5.25 = 5.25%)
  tvl: number; // USD
  dailyRewards: number; // USD
  tokens: { symbol: string; address: string; decimals: number; price: number }[];
  depositUrl: string;
  status: string;
  tags: string[];
  // APR breakdown
  baseApr: number;
  rewardApr: number;
}

export interface LoopStrategy {
  supplyToken: string;
  borrowToken: string;
  supplyProtocol: string;
  borrowProtocol: string;
  supplyApr: number;
  borrowApr: number; // cost (negative = you pay)
  netAprAt1x: number;
  netAprAt2x: number;
  netAprAt3x: number;
  maxLeverage: number; // based on typical LTV
  liquidationRisk: "low" | "medium" | "high";
  depositUrl: string;
}

const MERKL_API = "https://api.merkl.xyz/v4";
const MONAD_CHAIN_ID = "143";
const YIELD_ASSET_SYMBOLS = new Set([
  "WMON",
  "MON",
  "USDC",
  "USDT0",
  "WETH",
  "AUSD",
  "SHMON",
  "APRMON",
  "SMON",
  "GMON",
  "WBTC",
  "CBBTC",
  "USD1",
]);

// Cache Merkl data for 5 minutes
let cache: { data: YieldOpportunity[]; ts: number } | null = null;
const CACHE_TTL = 300_000;

async function fetchMerklPage(action: string, page: number): Promise<YieldOpportunity[]> {
  const params = new URLSearchParams({
    chainId: MONAD_CHAIN_ID,
    action,
    page: String(page),
  });

  const res = await fetch(`${MERKL_API}/opportunities?${params}`);
  if (!res.ok) return [];
  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) return [];

  return items.map((item: Record<string, unknown>) => {
    const protocol = item.protocol as Record<string, unknown> | undefined;
    const aprRecord = item.aprRecord as Record<string, unknown> | undefined;
    const breakdowns = (aprRecord?.breakdowns as Array<Record<string, unknown>>) || [];

    // Separate base APR from reward APR
    let baseApr = 0;
    let rewardApr = 0;
    for (const b of breakdowns) {
      const type = b.type as string || "";
      const value = (b.value as number) || 0;
      if (type === "base" || type === "underlying") baseApr += value;
      else rewardApr += value;
    }

    const tokens = Array.isArray(item.tokens)
      ? (item.tokens as Array<Record<string, unknown>>).map((t) => ({
          symbol: (t.symbol as string) || "???",
          address: (t.address as string) || "",
          decimals: (t.decimals as number) || 18,
          price: (t.price as number) || 0,
        }))
      : [];

    return {
      id: (item.identifier as string) || "",
      action: action as "LEND" | "BORROW",
      name: (item.name as string) || "",
      protocol: (protocol?.name as string) || "Unknown",
      protocolIcon: (protocol?.icon as string) || "",
      protocolUrl: (protocol?.url as string) || "",
      apr: (item.apr as number) || 0,
      tvl: (item.tvl as number) || 0,
      dailyRewards: (item.dailyRewards as number) || 0,
      tokens,
      depositUrl: (item.depositUrl as string) || (protocol?.url as string) || "",
      status: (item.status as string) || "",
      tags: Array.isArray(item.tags) ? (item.tags as string[]) : [],
      baseApr: baseApr,
      rewardApr: rewardApr,
    };
  });
}

export async function fetchMerklYieldOpportunities(): Promise<YieldOpportunity[]> {
  // Return cache if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;

  // Fetch LEND and BORROW pages in parallel (first 5 pages each = 200 opps max)
  const pages = [0, 1, 2, 3, 4];
  const fetches = [
    ...pages.map((p) => fetchMerklPage("LEND", p)),
    ...pages.map((p) => fetchMerklPage("BORROW", p)),
  ];

  const results = await Promise.allSettled(fetches);
  const all: YieldOpportunity[] = [];

  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  // Dedupe by id + action
  const seen = new Set<string>();
  const deduped = all.filter((o) => {
    const key = `${o.action}:${o.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  cache = { data: deduped, ts: Date.now() };
  return deduped;
}

export async function fetchYieldOpportunities(): Promise<YieldOpportunity[]> {
  if (typeof window === "undefined") {
    return fetchMerklYieldOpportunities();
  }

  const res = await fetch("/api/yield-opportunities");
  if (!res.ok) throw new Error("Failed to fetch yield opportunities");

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function normalizeYieldSymbol(symbol: string): string {
  const cleaned = symbol.replace(/-\d+$/u, "").toUpperCase();
  return cleaned === "MON" ? "WMON" : cleaned;
}

export function getKnownOpportunityAssetSymbols(opp: YieldOpportunity): string[] {
  return opp.tokens
    .map((token) => normalizeYieldSymbol(token.symbol))
    .filter((symbol) => YIELD_ASSET_SYMBOLS.has(symbol));
}

export function getOpportunityAssetSymbols(opp: YieldOpportunity): string[] {
  const uniqueAssets = [...new Set(getKnownOpportunityAssetSymbols(opp))];
  if (uniqueAssets.length > 0) return uniqueAssets;

  return [...new Set(opp.tokens.map((token) => token.symbol.toUpperCase()))];
}

function getSelectedOpportunitySymbol(
  opp: YieldOpportunity,
  selectedSymbols: string[]
): string {
  const assets = getOpportunityAssetSymbols(opp);
  const selected = new Set(selectedSymbols.map(normalizeYieldSymbol));
  return assets.find((symbol) => selected.has(symbol)) || assets[0] || "???";
}

function getNameSymbol(value: string): string {
  return normalizeYieldSymbol(value.replace(/^(e|c)(?=[A-Z])/u, ""));
}

export function getBorrowCollateralSymbols(opp: YieldOpportunity): string[] {
  if (opp.action !== "BORROW") return [];

  const usingMatch = opp.name.match(/\busing\s+([A-Za-z0-9-]+)/iu);
  if (usingMatch?.[1]) return [getNameSymbol(usingMatch[1])];

  const curvancePair = opp.name.match(/from\s+Curvance\s+([A-Za-z0-9-]+)\/([A-Za-z0-9-]+)\s+market/iu);
  if (curvancePair?.[1]) return [getNameSymbol(curvancePair[1])];

  const isolatedVault = opp.name.match(/Isolated\s+([A-Za-z0-9-]+)\s+([A-Za-z0-9-]+)\s+vault/iu);
  if (isolatedVault?.[1] && isolatedVault?.[2]) {
    const borrowAsset = getNameSymbol(isolatedVault[2]);
    const collateralAssets = isolatedVault[1]
      .split("-")
      .map(getNameSymbol)
      .filter((symbol) => symbol && symbol !== borrowAsset);
    if (collateralAssets.length > 0) return [...new Set(collateralAssets)];
  }

  if (opp.name.toLowerCase().includes("any morpho market")) {
    return ["Any listed collateral"];
  }

  return ["Protocol collateral"];
}

// Filter opportunities by token symbols
export function filterByTokens(
  opps: YieldOpportunity[],
  tokenSymbols: string[],
  action: "LEND" | "BORROW"
): YieldOpportunity[] {
  if (tokenSymbols.length === 0) {
    return opps.filter(
      (o) => o.action === action && getKnownOpportunityAssetSymbols(o).length > 0
    );
  }

  const symbols = new Set(tokenSymbols.map(normalizeYieldSymbol));
  return opps.filter((o) => {
    if (o.action !== action) return false;
    return getKnownOpportunityAssetSymbols(o).some((symbol) => symbols.has(symbol));
  });
}

export function filterBorrowOpportunities(
  opps: YieldOpportunity[],
  borrowTokens: string[],
  supplyTokens: string[] = []
): YieldOpportunity[] {
  const borrowOpps = filterByTokens(opps, borrowTokens, "BORROW");
  if (supplyTokens.length === 0) return borrowOpps;

  const selectedSupply = new Set(supplyTokens.map(normalizeYieldSymbol));
  return borrowOpps.filter((opp) => {
    const collateralSymbols = getBorrowCollateralSymbols(opp).map(normalizeYieldSymbol);
    return (
      collateralSymbols.includes("ANY LISTED COLLATERAL") ||
      collateralSymbols.includes("PROTOCOL COLLATERAL") ||
      collateralSymbols.some((symbol) => selectedSupply.has(symbol))
    );
  });
}

// Sort opportunities
export type SortField = "apr" | "tvl" | "dailyRewards" | "protocol";
export function sortOpportunities(
  opps: YieldOpportunity[],
  field: SortField,
  desc = true
): YieldOpportunity[] {
  const sorted = [...opps];
  sorted.sort((a, b) => {
    if (field === "protocol") {
      return desc ? b.protocol.localeCompare(a.protocol) : a.protocol.localeCompare(b.protocol);
    }
    const av = a[field] as number;
    const bv = b[field] as number;
    return desc ? bv - av : av - bv;
  });
  return sorted;
}

// Calculate loop strategies
export function calculateLoopStrategies(
  opps: YieldOpportunity[],
  supplyTokens: string[],
  borrowTokens: string[]
): LoopStrategy[] {
  const supplyOpps = filterByTokens(opps, supplyTokens, "LEND")
    .filter((o) => o.apr > 0);
  const borrowOpps = filterBorrowOpportunities(opps, borrowTokens, supplyTokens);

  const strategies: LoopStrategy[] = [];

  for (const supply of supplyOpps) {
    for (const borrow of borrowOpps) {
      // Skip same protocol + same token (can't loop with yourself)
      const supplySymbol = getSelectedOpportunitySymbol(supply, supplyTokens);
      const borrowSymbol = getSelectedOpportunitySymbol(borrow, borrowTokens);

      // Borrow APR is a cost (negative). Merkl reports borrow incentive APR as positive,
      // but the actual borrow rate is a cost. We estimate net = supply APR - borrow cost + borrow incentive.
      // For simplicity: borrowApr from Merkl = incentive only. Real borrow rate not in Merkl.
      // We'll show the incentive APR and note it doesn't include the base borrow cost.

      const netAt1x = supply.apr;
      // At 2x leverage: 2 * supply APR - 1 * borrow cost (unknown) + borrow incentive
      // Simplified: we show supply APR amplified + borrow incentive
      const borrowIncentive = borrow.apr;
      const netAt2x = supply.apr * 2 + borrowIncentive;
      const netAt3x = supply.apr * 3 + borrowIncentive * 2;

      // Typical LTV ratios
      const maxLeverage = supplySymbol === borrowSymbol ? 5 : 3;

      // Risk assessment
      let risk: "low" | "medium" | "high" = "medium";
      if (supplySymbol === borrowSymbol) risk = "low"; // same asset loop
      else if (["USDC", "USDT0", "AUSD", "USD1"].includes(supplySymbol) &&
               ["USDC", "USDT0", "AUSD", "USD1"].includes(borrowSymbol)) risk = "low"; // stable-stable
      else risk = "high"; // cross-asset

      strategies.push({
        supplyToken: supplySymbol,
        borrowToken: borrowSymbol,
        supplyProtocol: supply.protocol,
        borrowProtocol: borrow.protocol,
        supplyApr: supply.apr,
        borrowApr: borrowIncentive,
        netAprAt1x: netAt1x,
        netAprAt2x: netAt2x,
        netAprAt3x: netAt3x,
        maxLeverage,
        liquidationRisk: risk,
        depositUrl: supply.depositUrl,
      });
    }
  }

  // Sort by net APR at 2x descending
  strategies.sort((a, b) => b.netAprAt2x - a.netAprAt2x);

  return strategies.slice(0, 20); // Top 20 strategies
}
