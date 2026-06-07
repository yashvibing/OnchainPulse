import { withServerCache, type CacheResult } from "@/lib/serverCache";
import { monadClient } from "@/lib/client";
import { CONTRACTS } from "@/config/chain";
import { STAKING_PROTOCOLS } from "@/config/protocols";
import { fetchJsonWithRetry } from "@/lib/sourceFetch";
import { fetchTokenMarkets, type TokenMarket } from "@/services/tokenMarkets";
import { fetchCombinedYieldOpportunitiesWithMeta } from "@/services/yields-aggregator";

const ANALYTICS_CACHE_KEY = "analytics:monad:v2";
const ANALYTICS_TTL_MS = 5 * 60 * 1000;
const ANALYTICS_STALE_TTL_MS = 30 * 60 * 1000;
const BLOCK_TIME_SAMPLE_SIZE = 100n;

const MONSCOPE_DECENTRALIZATION_URL = "https://monscope.xyz/api/v1/decentralization";
const MONSCOPE_VALIDATORS_URL = "https://monscope.xyz/api/v1/validators";
const MONAD_FORUM_MIPS_URL = "https://forum.monad.xyz/c/mips/8.json";
const DEFILLAMA_MON_PRICE_URL = "https://coins.llama.fi/prices/current/coingecko:monad";
const COINGECKO_MON_URL =
  "https://api.coingecko.com/api/v3/coins/monad?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false";
const GECKO_WMON_TOKEN_URL =
  `https://api.geckoterminal.com/api/v2/networks/monad/tokens/${CONTRACTS.wmon}`;
const DEFILLAMA_STABLECOINS_URL = "https://stablecoins.llama.fi/stablecoins?chain=Monad";
const DEFILLAMA_DEX_OVERVIEW_URL =
  "https://api.llama.fi/overview/dexs/Monad?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume";
const DEFILLAMA_FEES_OVERVIEW_URL =
  "https://api.llama.fi/overview/fees/Monad?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyFees";
const DEFILLAMA_CHAINS_URL = "https://api.llama.fi/v2/chains";
const DEFILLAMA_YIELDS_URL = "https://yields.llama.fi/pools";

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

export interface AnalyticsStablecoin {
  symbol: string;
  valueUsd: number;
  sharePct: number;
  change30dPct?: number;
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
    openInterestUsd?: number;
    priceTrend: AnalyticsPoint[];
  };
  supply: {
    totalSupplyMon?: number;
    circulatingSupplyMon?: number;
    circulatingPct?: number;
    activeStakeMon?: number;
    lockedOrStakedMon?: number;
    burnedMon?: number;
  };
  staking: {
    activeValidators?: number;
    activeSetCap?: number;
    totalActiveStakeMon?: number;
    totalValueStakedUsd?: number;
    estimatedApyPct?: number;
    minApyPct?: number;
    maxApyPct?: number;
    activeNodes?: number;
    minDelegationMon?: number;
    unbondingHours?: number;
    delegationFlow7dMon?: number;
    meanCommissionPct?: number;
    medianCommissionPct?: number;
    atCommissionCap?: number;
  };
  network: {
    blockHeight?: number;
    gasGwei?: number;
    blockTimeSeconds?: number;
    finalitySeconds?: number;
    parallelExecutionPct?: number;
    epoch?: number;
    epochProgressPct?: number;
    epochTimeRemaining?: string;
  };
  economy: {
    inflationRatePct?: number;
    burnRate24hMon?: number;
    blockRewardMon?: number;
    netEmissionYearMon?: number;
    dailyFeesUsd?: number;
    annualizedFeesUsd?: number;
    psRatio?: number;
    pfRatio?: number;
    feeTrend: AnalyticsPoint[];
  };
  unlocks: {
    nextUnlockDate?: string;
    nextUnlockMon?: number;
    nextUnlockPctOfCirculating?: number;
    label?: string;
  };
  flows: {
    exchangeInflowMon?: number;
    exchangeOutflowMon?: number;
    netFlowMon?: number;
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
    totalChainTvlUsd?: number;
    protocolTvl: AnalyticsBar[];
    categoryTvl: AnalyticsBar[];
    topRates: AnalyticsBar[];
    topDexLiquidity: AnalyticsBar[];
    volume30dTrend: AnalyticsPoint[];
  };
  stablecoins: {
    totalUsd: number;
    assets: AnalyticsStablecoin[];
  };
  dex: {
    volume24hUsd?: number;
    volume7dUsd?: number;
    volume30dUsd?: number;
    tvlUsd?: number;
    fees24hUsd?: number;
    fees7dUsd?: number;
    fees30dUsd?: number;
    volumeToTvlPct?: number;
    feesToTvlPct?: number;
    volumeTrend: AnalyticsPoint[];
    feeTrend: AnalyticsPoint[];
    topProtocols: AnalyticsBar[];
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

interface GeckoTokenResponse {
  data?: {
    attributes?: {
      price_usd?: string | number | null;
      fdv_usd?: string | number | null;
      market_cap_usd?: string | number | null;
      volume_usd?: {
        h24?: string | number | null;
      };
    };
  };
}

interface AnalyticsMarketStats {
  priceUsd?: number;
  marketCapUsd?: number;
  fdvUsd?: number;
  volume24hUsd?: number;
  change24hPct?: number;
  totalSupplyMon?: number;
  circulatingSupplyMon?: number;
}

interface CoinGeckoMonResponse {
  market_data?: {
    current_price?: { usd?: number };
    market_cap?: { usd?: number };
    fully_diluted_valuation?: { usd?: number };
    total_volume?: { usd?: number };
    price_change_percentage_24h?: number;
    total_supply?: number;
    circulating_supply?: number;
  };
}

interface DefiLlamaStablecoinsResponse {
  peggedAssets?: Array<{
    symbol?: string;
    chainCirculating?: {
      Monad?: {
        current?: { peggedUSD?: number };
        circulatingPrevMonth?: { peggedUSD?: number };
      };
    };
  }>;
}

interface DefiLlamaOverviewResponse {
  total24h?: number;
  total7d?: number;
  total30d?: number;
  totalDataChart?: Array<[number, number]>;
  protocols?: Array<{
    displayName?: string;
    name?: string;
    total24h?: number;
  }>;
}

interface DefiLlamaChain {
  name?: string;
  tvl?: number;
}

interface DefiLlamaYieldResponse {
  data?: Array<{
    chain?: string;
    project?: string;
    symbol?: string;
    apy?: number;
  }>;
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
  epoch?: number;
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

function percentChange(current?: number, previous?: number) {
  if (!current || !previous) return undefined;
  return ((current - previous) / previous) * 100;
}

function toPoints(chart?: Array<[number, number]>) {
  return (chart || [])
    .map(([timestamp, value]) => ({ timestamp, value }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value));
}

export function calculateAverageBlockTimeSeconds(
  latestTimestamp: bigint,
  sampleTimestamp: bigint,
  sampleSize: bigint
) {
  if (sampleSize <= 0n) return undefined;

  const elapsedSeconds = Number(latestTimestamp - sampleTimestamp);
  const sampledBlocks = Number(sampleSize);
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return undefined;
  if (!Number.isFinite(sampledBlocks) || sampledBlocks <= 0) return undefined;

  return Math.round((elapsedSeconds / sampledBlocks) * 100) / 100;
}

export function pickMonMarketStats(
  nativeStats: AnalyticsMarketStats,
  tokenStats: AnalyticsMarketStats,
  poolMarket?: Pick<TokenMarket, "priceUsd" | "marketCapUsd" | "fdvUsd">
) {
  const marketCapUsd =
    nativeStats.marketCapUsd ??
    (nativeStats.priceUsd && nativeStats.circulatingSupplyMon
      ? nativeStats.priceUsd * nativeStats.circulatingSupplyMon
      : undefined) ??
    tokenStats.marketCapUsd ??
    poolMarket?.marketCapUsd;

  return {
    priceUsd: nativeStats.priceUsd ?? tokenStats.priceUsd ?? poolMarket?.priceUsd,
    marketCapUsd,
    fdvUsd: nativeStats.fdvUsd ?? tokenStats.fdvUsd ?? poolMarket?.fdvUsd,
    volume24hUsd: nativeStats.volume24hUsd ?? tokenStats.volume24hUsd,
    change24hPct: nativeStats.change24hPct,
    totalSupplyMon: nativeStats.totalSupplyMon,
    circulatingSupplyMon: nativeStats.circulatingSupplyMon,
  };
}

async function fetchCurrentMonPrice() {
  const data = await fetchJsonWithRetry<DefiLlamaPriceResponse>(DEFILLAMA_MON_PRICE_URL, {
    sourceName: "defillama-mon-price",
    timeoutMs: 8_000,
    retries: 1,
  });
  return data.coins?.["coingecko:monad"]?.price;
}

async function fetchMonMarketStats() {
  const data = await fetchJsonWithRetry<GeckoTokenResponse>(GECKO_WMON_TOKEN_URL, {
    sourceName: "geckoterminal-wmon-token",
    timeoutMs: 8_000,
    retries: 1,
  });
  const attrs = data.data?.attributes;

  return {
    priceUsd: toNumber(attrs?.price_usd),
    marketCapUsd: toNumber(attrs?.market_cap_usd),
    fdvUsd: toNumber(attrs?.fdv_usd),
    volume24hUsd: toNumber(attrs?.volume_usd?.h24),
  };
}

async function fetchCoinGeckoMonStats() {
  const data = await fetchJsonWithRetry<CoinGeckoMonResponse>(COINGECKO_MON_URL, {
    sourceName: "coingecko-mon",
    timeoutMs: 8_000,
    retries: 1,
  });
  const market = data.market_data;

  return {
    priceUsd: toNumber(market?.current_price?.usd),
    marketCapUsd: toNumber(market?.market_cap?.usd),
    fdvUsd: toNumber(market?.fully_diluted_valuation?.usd),
    volume24hUsd: toNumber(market?.total_volume?.usd),
    change24hPct: toNumber(market?.price_change_percentage_24h),
    totalSupplyMon: toNumber(market?.total_supply),
    circulatingSupplyMon: toNumber(market?.circulating_supply),
  };
}

async function fetchStablecoins() {
  const data = await fetchJsonWithRetry<DefiLlamaStablecoinsResponse>(DEFILLAMA_STABLECOINS_URL, {
    sourceName: "defillama-stablecoins-monad",
    timeoutMs: 10_000,
    retries: 1,
  });

  const assets = (data.peggedAssets || [])
    .map((asset) => {
      const monad = asset.chainCirculating?.Monad;
      const current = toNumber(monad?.current?.peggedUSD) || 0;
      const previousMonth = toNumber(monad?.circulatingPrevMonth?.peggedUSD);
      return {
        symbol: asset.symbol || "Unknown",
        valueUsd: current,
        sharePct: 0,
        change30dPct: percentChange(current, previousMonth),
      };
    })
    .filter((asset) => asset.valueUsd > 0)
    .sort((a, b) => b.valueUsd - a.valueUsd);

  const totalUsd = sum(assets.map((asset) => asset.valueUsd));

  return {
    totalUsd,
    assets: assets
      .map((asset) => ({
        ...asset,
        sharePct: totalUsd > 0 ? (asset.valueUsd / totalUsd) * 100 : 0,
      }))
      .slice(0, 10),
  };
}

async function fetchDexOverview() {
  return fetchJsonWithRetry<DefiLlamaOverviewResponse>(DEFILLAMA_DEX_OVERVIEW_URL, {
    sourceName: "defillama-dexs-monad",
    timeoutMs: 10_000,
    retries: 1,
  });
}

async function fetchFeesOverview() {
  return fetchJsonWithRetry<DefiLlamaOverviewResponse>(DEFILLAMA_FEES_OVERVIEW_URL, {
    sourceName: "defillama-fees-monad",
    timeoutMs: 10_000,
    retries: 1,
  });
}

async function fetchChainTvl() {
  const chains = await fetchJsonWithRetry<DefiLlamaChain[]>(DEFILLAMA_CHAINS_URL, {
    sourceName: "defillama-chains",
    timeoutMs: 10_000,
    retries: 1,
  });
  return chains.find((chain) => chain.name === "Monad")?.tvl;
}

async function fetchStakingApySummary() {
  const data = await fetchJsonWithRetry<DefiLlamaYieldResponse>(DEFILLAMA_YIELDS_URL, {
    sourceName: "defillama-yields-staking",
    timeoutMs: 10_000,
    retries: 1,
  });

  const protocolNames = STAKING_PROTOCOLS.map((protocol) => protocol.name.toLowerCase());
  const lstSymbols = STAKING_PROTOCOLS.map((protocol) => protocol.lstSymbol.toLowerCase());
  const apys = (data.data || [])
    .filter((pool) => pool.chain === "Monad")
    .filter((pool) => {
      const project = (pool.project || "").toLowerCase();
      const symbol = (pool.symbol || "").toLowerCase();
      return (
        protocolNames.some((name) => project.includes(name)) ||
        lstSymbols.some((lstSymbol) => symbol.includes(lstSymbol))
      );
    })
    .map((pool) => toNumber(pool.apy))
    .filter((apy): apy is number => typeof apy === "number" && apy > 0);

  if (apys.length === 0) return {};

  return {
    estimatedApyPct: sum(apys) / apys.length,
    minApyPct: Math.min(...apys),
    maxApyPct: Math.max(...apys),
  };
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
    const sampleSize =
      blockNumber >= BLOCK_TIME_SAMPLE_SIZE ? BLOCK_TIME_SAMPLE_SIZE : blockNumber;
    const sampleBlockNumber = blockNumber - sampleSize;
    const [gasPrice, latestBlock, sampleBlock] = await Promise.all([
      monadClient.getGasPrice(),
      monadClient.getBlock({ blockNumber }),
      sampleSize > 0n ? monadClient.getBlock({ blockNumber: sampleBlockNumber }) : undefined,
    ]);

    const blockTimeSeconds =
      latestBlock && sampleBlock
        ? calculateAverageBlockTimeSeconds(latestBlock.timestamp, sampleBlock.timestamp, sampleSize)
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
    coinGeckoMonStats,
    monMarketStats,
    yieldOpportunities,
    stablecoins,
    dexOverview,
    feesOverview,
    chainTvl,
    stakingApySummary,
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
    fetchCoinGeckoMonStats().catch(() => ({} as AnalyticsMarketStats)),
    fetchMonMarketStats().catch(() => ({} as AnalyticsMarketStats)),
    fetchCombinedYieldOpportunitiesWithMeta().catch(() => ({ data: [] })),
    fetchStablecoins().catch(() => ({ totalUsd: 0, assets: [] })),
    fetchDexOverview().catch(() => ({} as DefiLlamaOverviewResponse)),
    fetchFeesOverview().catch(() => ({} as DefiLlamaOverviewResponse)),
    fetchChainTvl().catch(() => undefined),
    fetchStakingApySummary().catch(() => ({})),
  ]);

  const markets = tokenMarkets.data || [];
  const opportunities = yieldOpportunities.data || [];
  const monMarket =
    markets.find((market) => market.tokenSymbol === "MON") ||
    markets.find((market) => market.tokenSymbol === "WMON");
  const resolvedMonMarket = pickMonMarketStats(coinGeckoMonStats, monMarketStats, monMarket);

  const protocolTvl = [...opportunities.reduce((map, opportunity) => {
    map.set(opportunity.protocol, (map.get(opportunity.protocol) || 0) + (opportunity.tvl || 0));
    return map;
  }, new Map<string, number>())]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const categoryTvl = [...opportunities.reduce((map, opportunity) => {
    const label = opportunity.opportunityType || opportunity.action || "Other";
    map.set(label, (map.get(label) || 0) + (opportunity.tvl || 0));
    return map;
  }, new Map<string, number>())]
    .map(([label, value]) => ({ label, value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const topRates = opportunities
    .filter((opportunity) => opportunity.apr > 0)
    .sort((a, b) => b.apr - a.apr)
    .slice(0, 6)
    .map((opportunity) => ({
      label: `${opportunity.name} on ${opportunity.protocol}`,
      value: opportunity.apr,
      detail: opportunity.opportunityType || opportunity.action,
    }));

  const dexLiquidityByProtocol = [...markets.reduce((map, market) => {
    map.set(market.dexLabel, (map.get(market.dexLabel) || 0) + (market.liquidityUsd || 0));
    return map;
  }, new Map<string, number>())]
    .map(([label, value]) => ({ label, value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const topDexLiquidity = dexLiquidityByProtocol.slice(0, 6);
  const dexTvlUsd = sum(dexLiquidityByProtocol.map((item) => item.value));
  const dexVolume24hUsd = toNumber(dexOverview.total24h);
  const dexFees24hUsd = toNumber(feesOverview.total24h);
  const dailyFeesUsd = dexFees24hUsd;
  const annualizedFeesUsd =
    typeof dailyFeesUsd === "number" ? dailyFeesUsd * 365 : undefined;
  const marketCapUsd = resolvedMonMarket.marketCapUsd;
  const monPriceUsd = monPrice ?? resolvedMonMarket.priceUsd;

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
      "CoinGecko",
      "Monad Forum",
      "DefiLlama",
      "GeckoTerminal",
      "Merkl",
      "Monad RPC",
    ],
    market: {
      priceUsd: monPriceUsd,
      change24hPct:
        trendChange(priceTrend, "24h") ??
        resolvedMonMarket.change24hPct ??
        monMarket?.priceChange24h,
      change30dPct: trendChange(priceTrend, "30d"),
      marketCapUsd,
      fdvUsd: resolvedMonMarket.fdvUsd,
      volume24hUsd: resolvedMonMarket.volume24hUsd ?? sum(markets.map((market) => market.volume24hUsd)),
      priceTrend,
    },
    supply: {
      totalSupplyMon: resolvedMonMarket.totalSupplyMon,
      circulatingSupplyMon: resolvedMonMarket.circulatingSupplyMon,
      circulatingPct:
        resolvedMonMarket.totalSupplyMon && resolvedMonMarket.circulatingSupplyMon
          ? (resolvedMonMarket.circulatingSupplyMon / resolvedMonMarket.totalSupplyMon) * 100
          : undefined,
      activeStakeMon,
      lockedOrStakedMon: activeStakeMon,
    },
    staking: {
      activeValidators,
      activeSetCap:
        decentralization.metrics?.active_set?.activeCap ||
        validators.active_set_cap,
      totalActiveStakeMon: activeStakeMon,
      totalValueStakedUsd:
        activeStakeMon && monPriceUsd
          ? activeStakeMon * monPriceUsd
          : undefined,
      activeNodes: activeValidators,
      ...stakingApySummary,
      meanCommissionPct: decentralization.metrics?.commission?.meanPct,
      medianCommissionPct: decentralization.metrics?.commission?.medianPct,
      atCommissionCap: decentralization.metrics?.commission?.atVdpCap,
    },
    network: {
      ...rpc,
      epoch: decentralization.epoch,
    },
    economy: {
      dailyFeesUsd,
      annualizedFeesUsd,
      psRatio:
        marketCapUsd && annualizedFeesUsd && annualizedFeesUsd > 0
          ? marketCapUsd / annualizedFeesUsd
          : undefined,
      pfRatio:
        marketCapUsd && dexFees24hUsd && dexFees24hUsd > 0
          ? marketCapUsd / (dexFees24hUsd * 365)
          : undefined,
      feeTrend: toPoints(feesOverview.totalDataChart).slice(-30),
    },
    unlocks: {},
    flows: {},
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
      totalChainTvlUsd: chainTvl,
      protocolTvl,
      categoryTvl,
      topRates,
      topDexLiquidity,
      volume30dTrend: dailyVolume,
    },
    stablecoins,
    dex: {
      volume24hUsd: dexVolume24hUsd,
      volume7dUsd: toNumber(dexOverview.total7d),
      volume30dUsd: toNumber(dexOverview.total30d),
      tvlUsd: dexTvlUsd,
      fees24hUsd: dexFees24hUsd,
      fees7dUsd: toNumber(feesOverview.total7d),
      fees30dUsd: toNumber(feesOverview.total30d),
      volumeToTvlPct:
        dexVolume24hUsd && dexTvlUsd > 0 ? (dexVolume24hUsd / dexTvlUsd) * 100 : undefined,
      feesToTvlPct:
        dexFees24hUsd && dexTvlUsd > 0 ? (dexFees24hUsd / dexTvlUsd) * 100 : undefined,
      volumeTrend: toPoints(dexOverview.totalDataChart).slice(-30),
      feeTrend: toPoints(feesOverview.totalDataChart).slice(-30),
      topProtocols:
        dexOverview.protocols
          ?.map((protocol) => ({
            label: protocol.displayName || protocol.name || "Unknown",
            value: toNumber(protocol.total24h) || 0,
          }))
          .filter((protocol) => protocol.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 6) || [],
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
