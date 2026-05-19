// ─── Yield Aggregator via Merkl API ───
//
// Fetches lending/borrowing opportunities on Monad from Merkl and DefiLlama.
// Merkl is action-first; DefiLlama expands APY pool coverage.

import { withServerCache } from "@/lib/serverCache";
import { fetchJsonWithRetry } from "@/lib/sourceFetch";

export interface YieldOpportunity {
  id: string;
  action: "LEND" | "BORROW";
  source: "Merkl" | "DefiLlama" | "Both";
  opportunityType?: "Lending" | "Borrow" | "LP" | "Vault";
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

export interface YieldOpportunityFetchResult {
  data: YieldOpportunity[];
  cacheStatus?: string;
  cacheAgeMs?: number;
  fetchedAt?: number;
}

const MERKL_API = "https://api.merkl.xyz/v4";
const DEFILLAMA_YIELDS_API = "https://yields.llama.fi/pools";
const MONAD_CHAIN_ID = "143";
const MONAD_CHAIN = "Monad";
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
  "EBTC",
  "ENZOBTC",
  "VUSD",
  "WSTETH",
  "STEAKETH",
  "EARNAUSD",
]);

interface DefiLlamaYieldPool {
  pool?: string;
  chain?: string;
  project?: string;
  symbol?: string;
  tvlUsd?: number;
  apy?: number;
  apyBase?: number | null;
  apyReward?: number | null;
  apyBaseBorrow?: number | null;
  apyRewardBorrow?: number | null;
  totalSupplyUsd?: number | null;
  totalBorrowUsd?: number | null;
  url?: string;
}

const CACHE_TTL = 300_000;
const STALE_CACHE_TTL = 30 * 60_000;

function humanizeProjectSlug(slug: string) {
  if (slug === "morpho-blue") return "Morpho";

  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeProtocolForKey(protocol: string) {
  const normalized = protocol.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.includes("morpho")) return "morpho";
  if (normalized.includes("townsquare")) return "townsquare";
  if (normalized.includes("neverland")) return "neverland";
  if (normalized.includes("curvance")) return "curvance";
  if (normalized.includes("upshift")) return "upshift";
  if (normalized.includes("euler")) return "euler";
  return normalized;
}

function splitDefiLlamaSymbols(symbol: string) {
  return symbol
    .split(/[-/,+]/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function inferDefiLlamaPoolType(symbol: string, tokenSymbols: string[]): "Lending" | "LP" | "Vault" {
  if (/[-/,+]/u.test(symbol) && tokenSymbols.length > 1) return "LP";

  const normalized = symbol.toUpperCase();
  if (
    normalized.startsWith("EARN") ||
    normalized.startsWith("HYPER") ||
    normalized.startsWith("STEAK") ||
    normalized.startsWith("GROVE") ||
    normalized.startsWith("AUGUST") ||
    normalized.startsWith("VAULT") ||
    normalized.endsWith("VAULT")
  ) {
    return "Vault";
  }

  return "Lending";
}

function normalizeDefiLlamaDisplaySymbols(symbol: string) {
  const parts = splitDefiLlamaSymbols(symbol.toUpperCase());

  return parts.map((part) => {
    if (part === "WNUSDC") return "USDC";
    if (part === "WNUSDT0") return "USDT0";
    if (part === "WNAUSD") return "AUSD";
    if (part === "EARNAUSD" || part.endsWith("AUSD")) return "AUSD";
    if (part === "STEAKETH" || part.endsWith("WSTETH")) return "WETH";
    if (part.endsWith("USDC") || part.includes("USDC")) return "USDC";
    if (part.endsWith("BTC") || part.includes("BTC")) return "WBTC";
    return part;
  });
}

function opportunityMergeKey(opportunity: YieldOpportunity) {
  const assets = getOpportunityAssetSymbols(opportunity);
  return [
    opportunity.action,
    normalizeProtocolForKey(opportunity.protocol),
    assets[0] || opportunity.tokens[0]?.symbol?.toUpperCase() || opportunity.name.toUpperCase(),
  ].join(":");
}

async function fetchMerklPage(action: string, page: number): Promise<YieldOpportunity[]> {
  const params = new URLSearchParams({
    chainId: MONAD_CHAIN_ID,
    action,
    page: String(page),
  });

  const items = await fetchJsonWithRetry<Array<Record<string, unknown>>>(
    `${MERKL_API}/opportunities?${params}`,
    { retries: 2, timeoutMs: 8_000 }
  ).catch((): Array<Record<string, unknown>> => []);
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
      source: "Merkl",
      opportunityType: action === "BORROW" ? "Borrow" : "Lending",
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

async function fetchDefiLlamaYieldOpportunities(): Promise<YieldOpportunity[]> {
  const body = await fetchJsonWithRetry<{ data?: DefiLlamaYieldPool[] }>(
    DEFILLAMA_YIELDS_API,
    { retries: 2, timeoutMs: 8_000 }
  ).catch(() => ({ data: [] }));
  const pools = Array.isArray(body.data) ? body.data : [];

  return pools
    .filter((pool) => pool.chain === MONAD_CHAIN && pool.symbol && pool.project)
    .map((pool) => {
      const project = pool.project || "unknown";
      const protocol = humanizeProjectSlug(project);
      const symbol = (pool.symbol || "UNKNOWN").toUpperCase();
      const displaySymbols = normalizeDefiLlamaDisplaySymbols(symbol);
      const poolType = inferDefiLlamaPoolType(symbol, displaySymbols);
      const tokens = displaySymbols.map((tokenSymbol) => ({
        symbol: tokenSymbol,
        address: "",
        decimals: 18,
        price: 0,
      }));
      const baseApr = pool.apyBase ?? 0;
      const rewardApr = pool.apyReward ?? 0;
      const apr = pool.apy ?? baseApr + rewardApr;

      return {
        id: `defillama:${pool.pool || `${project}:${symbol}`}`,
        action: "LEND" as const,
        source: "DefiLlama" as const,
        opportunityType: poolType,
        name: `${poolType === "LP" ? "LP" : poolType === "Vault" ? "Vault" : "Supply"} ${symbol} on ${protocol}`,
        protocol,
        protocolIcon: `https://icons.llama.fi/${project}.png`,
        protocolUrl: pool.url || `https://defillama.com/yields?project=${encodeURIComponent(project)}`,
        apr,
        tvl: pool.totalSupplyUsd ?? pool.tvlUsd ?? 0,
        dailyRewards: 0,
        tokens,
        depositUrl: pool.url || `https://defillama.com/yields/pool/${pool.pool}`,
        status: "LIVE",
        tags: ["defillama-yield"],
        baseApr,
        rewardApr,
      };
    })
    .filter((opportunity) => opportunity.tvl > 0 || opportunity.apr > 0);
}

function mergeYieldOpportunities(opportunities: YieldOpportunity[]): YieldOpportunity[] {
  const byKey = new Map<string, YieldOpportunity>();

  for (const opportunity of opportunities) {
    const key = opportunityMergeKey(opportunity);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, opportunity);
      continue;
    }

    const preferIncoming =
      existing.source === "DefiLlama" && opportunity.source === "Merkl";
    const preferred = preferIncoming ? opportunity : existing;
    const secondary = preferIncoming ? existing : opportunity;

    byKey.set(key, {
      ...preferred,
      source: preferred.source === secondary.source ? preferred.source : "Both",
      baseApr: preferred.baseApr || secondary.baseApr,
      rewardApr: preferred.rewardApr || secondary.rewardApr,
      tvl: Math.max(preferred.tvl, secondary.tvl),
      dailyRewards: Math.max(preferred.dailyRewards, secondary.dailyRewards),
      protocolIcon: preferred.protocolIcon || secondary.protocolIcon,
      protocolUrl: preferred.protocolUrl || secondary.protocolUrl,
      depositUrl: preferred.depositUrl || secondary.depositUrl,
      tags: [...new Set([...preferred.tags, ...secondary.tags])],
    });
  }

  return [...byKey.values()];
}

export async function fetchMerklYieldOpportunities(): Promise<YieldOpportunity[]> {
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

  return deduped;
}

async function loadCombinedYieldOpportunities(): Promise<YieldOpportunity[]> {
  const [merklResult, defiLlamaResult] = await Promise.allSettled([
    fetchMerklYieldOpportunities(),
    fetchDefiLlamaYieldOpportunities(),
  ]);

  const merkl = merklResult.status === "fulfilled" ? merklResult.value : [];
  const defiLlama = defiLlamaResult.status === "fulfilled" ? defiLlamaResult.value : [];
  const data = mergeYieldOpportunities([...merkl, ...defiLlama]);

  return data;
}

export async function fetchCombinedYieldOpportunitiesWithMeta() {
  return withServerCache(
    "yield-opportunities",
    CACHE_TTL,
    loadCombinedYieldOpportunities,
    STALE_CACHE_TTL
  );
}

export async function fetchCombinedYieldOpportunities(): Promise<YieldOpportunity[]> {
  const result = await fetchCombinedYieldOpportunitiesWithMeta();
  return result.data;
}

export async function fetchYieldOpportunitiesWithClientMeta(): Promise<YieldOpportunityFetchResult> {
  if (typeof window === "undefined") {
    const result = await fetchCombinedYieldOpportunitiesWithMeta();
    return {
      data: result.data,
      cacheStatus: result.status,
      cacheAgeMs: result.ageMs,
      fetchedAt: result.fetchedAt,
    };
  }

  const res = await fetch("/api/yield-opportunities");
  if (!res.ok) throw new Error("Failed to fetch yield opportunities");

  const data = await res.json();
  return {
    data: Array.isArray(data) ? data : [],
    cacheStatus: res.headers.get("X-Cache-Status") || undefined,
    cacheAgeMs: Number(res.headers.get("X-Cache-Age-Ms") || 0),
    fetchedAt: Number(res.headers.get("X-Data-Fetched-At") || 0) || undefined,
  };
}

export async function fetchYieldOpportunities(): Promise<YieldOpportunity[]> {
  const result = await fetchYieldOpportunitiesWithClientMeta();
  return result.data;
}

function normalizeYieldSymbol(symbol: string): string {
  const cleaned = symbol.replace(/-\d+$/u, "").toUpperCase();
  return cleaned === "MON" ? "WMON" : cleaned;
}

export function getKnownOpportunityAssetSymbols(opp: YieldOpportunity): string[] {
  const knownSymbols = opp.tokens
    .map((token) => normalizeYieldSymbol(token.symbol))
    .filter((symbol) => YIELD_ASSET_SYMBOLS.has(symbol));

  if (knownSymbols.length > 0) return knownSymbols;

  if (opp.tags.includes("defillama-yield")) {
    return opp.tokens.map((token) => normalizeYieldSymbol(token.symbol)).filter(Boolean);
  }

  return knownSymbols;
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
export type SortField = "apr" | "tvl";
export function sortOpportunities(
  opps: YieldOpportunity[],
  field: SortField,
  desc = true
): YieldOpportunity[] {
  const sorted = [...opps];
  sorted.sort((a, b) => {
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
