import { withServerCache, type CacheResult } from "@/lib/serverCache";
import { monadClient } from "@/lib/client";
import { fetchJsonWithRetry } from "@/lib/sourceFetch";
import { fetchTokenMarkets } from "@/services/tokenMarkets";
import { fetchCombinedYieldOpportunitiesWithMeta } from "@/services/yields-aggregator";

const ANALYTICS_CACHE_KEY = "analytics:monad:v1";
const ANALYTICS_TTL_MS = 5 * 60 * 1000;
const ANALYTICS_STALE_TTL_MS = 30 * 60 * 1000;

const MONSCOPE_DECENTRALIZATION_URL = "https://monscope.xyz/api/v1/decentralization";
const MONSCOPE_VALIDATORS_URL = "https://monscope.xyz/api/v1/validators";
const MONAD_FORUM_MIPS_URL = "https://forum.monad.xyz/c/mips/8.json";
const DEFILLAMA_MON_PRICE_URL = "https://coins.llama.fi/prices/current/coingecko:monad";

export interface AnalyticsPoint {
  timestamp: number;
  value: number;
}

export interface AnalyticsMetric {
  label: string;
  value: string;
  helper?: string;
}

export interface AnalyticsBar {
  label: string;
  value: number;
  detail?: string;
}

export interface AnalyticsValidator {
  rank: number;
  id: number;
  name: string;
  stakeMon: number;
  sharePct: number;
  commissionPct: number;
  website?: string;
  x?: string;
}

export interface AnalyticsMip {
  number: number;
  title: string;
  activity: string;
  url: string;
}

export interface AnalyticsPayload {
  generatedAt: number;
  sources: string[];
  market: {
    priceUsd?: number;
    change24hPct?: number;
    change30dPct?: number;
    marketCapUsd?: number;
    fdvUsd?: number;
    volume24hUsd?: number;
    priceTrend: AnalyticsPoint[];
  };
  supply: {
    totalSupplyMon?: number;
    circulatingSupplyMon?: number;
    circulatingPct?: number;
    activeStakeMon?: number;
  };
  staking: {
    activeValidators?: number;
    activeSetCap?: number;
    totalActiveStakeMon?: number;
    meanCommissionPct?: number;
    medianCommissionPct?: number;
    atCommissionCap?: number;
  };
  network: {
    blockHeight?: number;
    gasGwei?: number;
    blockTimeSeconds?: number;
  };
  decentralization: {
    nakamotoLiveness?: number;
    nakamotoSafety?: number;
    gini?: number;
    hhi?: number;
    top10SharePct?: number;
    activeValidators?: number;
    countries: AnalyticsBar[];
    providers: AnalyticsBar[];
  };
  defi: {
    totalTvlUsd: number;
    protocolTvl: AnalyticsBar[];
    topRates: AnalyticsBar[];
    topDexLiquidity: AnalyticsBar[];
    volume30dTrend: AnalyticsPoint[];
  };
  mips: AnalyticsMip[];
  validators: AnalyticsValidator[];
}

interface DefiLlamaPriceResponse {
  coins?: {
    "coingecko:monad"?: {
      price?: number;
      timestamp?: number;
    };
  };
}

interface MonscopeDecentralizationResponse {
  fetched_at?: string;
  epoch?: number;
  metrics?: {
    stake?: {
      totalStakeMON?: number;
      gini?: number;
      hhi?: number;
      nakamoto?: {
        liveness?: number;
        safety?: number;
      };
      shares?: {
        top10?: number;
      };
    };
    commission?: {
      meanPct?: number;
      medianPct?: number;
      atVdpCap?: number;
    };
    active_set?: {
      active?: number;
      activeCap?: number;
    };
    geo?: {
      countries?: Array<{
        label?: string;
        validatorCount?: number;
        stakePct?: number;
      }>;
    };
    infra?: {
      providers?: Array<{
        label?: string;
        validatorCount?: number;
        stakePct?: number;
      }>;
    };
  };
}

interface MonscopeValidatorsResponse {
  active_set_size?: number;
  active_set_cap?: number;
  total_active_stake_mon?: number;
  validators?: Array<{
    rank?: number;
    id?: number;
    name?: string;
    stake_mon?: number;
    share_pct?: number;
    commission_pct?: number;
    website?: string;
    x?: string;
  }>;
}

interface MonadForumMipsResponse {
  topic_list?: {
    topics?: Array<{
      id?: number;
      title?: string;
      slug?: string;
      created_at?: string;
      last_posted_at?: string;
    }>;
  };
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function sum(values: Array<number | undefined>) {
  return values.reduce<number>((total, value) => total + (value || 0), 0);
}

async function fetchCurrentMonPrice() {
  const data = await fetchJsonWithRetry<DefiLlamaPriceResponse>(DEFILLAMA_MON_PRICE_URL, {
    sourceName: "defillama-mon-price",
    timeoutMs: 8_000,
    retries: 1,
  });
  return data.coins?.["coingecko:monad"]?.price;
}

async function fetchPriceTrend() {
  const now = Math.floor(Date.now() / 1000);
  const data = await fetchJsonWithRetry<{
    coins?: { "coingecko:monad"?: { prices?: Array<{ timestamp: number; price: number }> } };
  }>(
    `https://coins.llama.fi/chart/coingecko:monad?start=${now - 30 * 86400}&span=120&period=6h`,
    {
      sourceName: "defillama-mon-price-chart",
      timeoutMs: 8_000,
      retries: 1,
    }
  );

  return (data.coins?.["coingecko:monad"]?.prices || [])
    .map((point) => ({
      timestamp: point.timestamp,
      value: point.price,
    }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value));
}

async function fetchRpcSnapshot() {
  try {
    const blockNumber = await monadClient.getBlockNumber();
    const [gasPrice, latestBlock, previousBlock] = await Promise.all([
      monadClient.getGasPrice(),
      monadClient.getBlock({ blockNumber }),
      blockNumber > 0n ? monadClient.getBlock({ blockNumber: blockNumber - 1n }) : undefined,
    ]);

    const blockTimeSeconds =
      latestBlock && previousBlock
        ? Number(latestBlock.timestamp - previousBlock.timestamp)
        : undefined;

    return {
      blockHeight: Number(blockNumber),
      gasGwei: Number(gasPrice) / 1e9,
      blockTimeSeconds,
    };
  } catch {
    return {};
  }
}

function trendChange(points: AnalyticsPoint[], lookback: "24h" | "30d") {
  if (points.length < 2) return undefined;
  const seconds = lookback === "24h" ? 24 * 3600 : 30 * 86400;
  const last = points[points.length - 1];
  if (!last?.value) return undefined;
  const target = last.timestamp - seconds;
  const first =
    points.find((point) => point.timestamp >= target) ||
    points[0];
  if (!first?.value) return undefined;
  return ((last.value - first.value) / first.value) * 100;
}

function shortDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function extractMipNumber(title?: string) {
  const match = title?.match(/\bMIP[\s-]*(\d+)\b/iu);
  return match ? Number(match[1]) : 0;
}

function cleanMipTitle(title: string, number: number) {
  return title
    .replace(new RegExp(`^\\s*MIP[\\s-]*${number}\\s*[-:]?\\s*`, "iu"), "")
    .trim();
}

function extractMips(data: MonadForumMipsResponse): AnalyticsMip[] {
  return (data.topic_list?.topics || [])
    .map((item) => {
      const title = item.title || "";
      const number = extractMipNumber(title);
      return {
        number,
        title: number > 0 ? cleanMipTitle(title, number) : title,
        activity: shortDate(item.last_posted_at || item.created_at),
        url:
          item.id && item.slug
            ? `https://forum.monad.xyz/t/${item.slug}/${item.id}`
            : "https://forum.monad.xyz/c/mips/8",
      };
    })
    .filter((item) => item.number > 0)
    .sort((a, b) => b.number - a.number)
    .slice(0, 8);
}

async function loadAnalytics(): Promise<AnalyticsPayload> {
  const [
    monPrice,
    priceTrend,
    rpc,
    decentralization,
    validators,
    mips,
    tokenMarkets,
    yieldOpportunities,
  ] = await Promise.all([
    fetchCurrentMonPrice().catch(() => undefined),
    fetchPriceTrend().catch(() => []),
    fetchRpcSnapshot(),
    fetchJsonWithRetry<MonscopeDecentralizationResponse>(MONSCOPE_DECENTRALIZATION_URL, {
      sourceName: "monscope-decentralization",
      timeoutMs: 8_000,
      retries: 1,
    }).catch(() => ({} as MonscopeDecentralizationResponse)),
    fetchJsonWithRetry<MonscopeValidatorsResponse>(MONSCOPE_VALIDATORS_URL, {
      sourceName: "monscope-validators",
      timeoutMs: 8_000,
      retries: 1,
    }).catch(() => ({} as MonscopeValidatorsResponse)),
    fetchJsonWithRetry<MonadForumMipsResponse>(MONAD_FORUM_MIPS_URL, {
      sourceName: "monad-forum-mips",
      timeoutMs: 8_000,
      retries: 1,
    }).catch(() => ({} as MonadForumMipsResponse)),
    fetchTokenMarkets().catch(() => ({ data: [] })),
    fetchCombinedYieldOpportunitiesWithMeta().catch(() => ({ data: [] })),
  ]);

  const markets = tokenMarkets.data || [];
  const opportunities = yieldOpportunities.data || [];
  const monMarket =
    markets.find((market) => market.tokenSymbol === "MON") ||
    markets.find((market) => market.tokenSymbol === "WMON");

  const protocolTvl = [...opportunities.reduce((map, opportunity) => {
    map.set(opportunity.protocol, (map.get(opportunity.protocol) || 0) + (opportunity.tvl || 0));
    return map;
  }, new Map<string, number>())]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const topRates = opportunities
    .filter((opportunity) => opportunity.apr > 0)
    .sort((a, b) => b.apr - a.apr)
    .slice(0, 6)
    .map((opportunity) => ({
      label: `${opportunity.name} on ${opportunity.protocol}`,
      value: opportunity.apr,
      detail: opportunity.opportunityType || opportunity.action,
    }));

  const topDexLiquidity = [...markets.reduce((map, market) => {
    map.set(market.dexLabel, (map.get(market.dexLabel) || 0) + (market.liquidityUsd || 0));
    return map;
  }, new Map<string, number>())]
    .map(([label, value]) => ({ label, value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const dailyVolume = markets
    .slice(0, 30)
    .map((market, index) => ({
      timestamp: Math.floor(Date.now() / 1000) - (29 - index) * 86400,
      value: market.volume24hUsd || 0,
    }));

  const activeStakeMon =
    decentralization.metrics?.stake?.totalStakeMON ||
    validators.total_active_stake_mon;

  const activeValidators =
    decentralization.metrics?.active_set?.active ||
    validators.active_set_size;

  return {
    generatedAt: Date.now(),
    sources: [
      "Monscope API",
      "Monad Forum",
      "DefiLlama",
      "GeckoTerminal",
      "Merkl",
      "Monad RPC",
    ],
    market: {
      priceUsd: monPrice || monMarket?.priceUsd,
      change24hPct: trendChange(priceTrend, "24h") ?? monMarket?.priceChange24h,
      change30dPct: trendChange(priceTrend, "30d"),
      marketCapUsd: monMarket?.marketCapUsd,
      fdvUsd: monMarket?.fdvUsd,
      volume24hUsd: sum(markets.map((market) => market.volume24hUsd)),
      priceTrend,
    },
    supply: {
      activeStakeMon,
    },
    staking: {
      activeValidators,
      activeSetCap:
        decentralization.metrics?.active_set?.activeCap ||
        validators.active_set_cap,
      totalActiveStakeMon: activeStakeMon,
      meanCommissionPct: decentralization.metrics?.commission?.meanPct,
      medianCommissionPct: decentralization.metrics?.commission?.medianPct,
      atCommissionCap: decentralization.metrics?.commission?.atVdpCap,
    },
    network: rpc,
    decentralization: {
      nakamotoLiveness: decentralization.metrics?.stake?.nakamoto?.liveness,
      nakamotoSafety: decentralization.metrics?.stake?.nakamoto?.safety,
      gini: decentralization.metrics?.stake?.gini,
      hhi: decentralization.metrics?.stake?.hhi,
      top10SharePct: decentralization.metrics?.stake?.shares?.top10,
      activeValidators,
      countries:
        decentralization.metrics?.geo?.countries?.slice(0, 8).map((country) => ({
          label: country.label || "Unknown",
          value: country.stakePct || 0,
          detail: `${country.validatorCount || 0} validators`,
        })) || [],
      providers:
        decentralization.metrics?.infra?.providers?.slice(0, 8).map((provider) => ({
          label: provider.label || "Unknown",
          value: provider.stakePct || 0,
          detail: `${provider.validatorCount || 0} validators`,
        })) || [],
    },
    defi: {
      totalTvlUsd: sum(opportunities.map((opportunity) => opportunity.tvl)),
      protocolTvl,
      topRates,
      topDexLiquidity,
      volume30dTrend: dailyVolume,
    },
    mips: extractMips(mips),
    validators:
      validators.validators?.slice(0, 20).map((validator) => ({
        rank: Number(validator.rank || 0),
        id: Number(validator.id || 0),
        name: validator.name || "Unknown",
        stakeMon: toNumber(validator.stake_mon) || 0,
        sharePct: toNumber(validator.share_pct) || 0,
        commissionPct: toNumber(validator.commission_pct) || 0,
        website: validator.website,
        x: validator.x,
      })) || [],
  };
}

export function fetchAnalytics(): Promise<CacheResult<AnalyticsPayload>> {
  return withServerCache(
    ANALYTICS_CACHE_KEY,
    ANALYTICS_TTL_MS,
    loadAnalytics,
    ANALYTICS_STALE_TTL_MS
  );
}
