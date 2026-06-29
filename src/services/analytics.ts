import { withServerCache, type CacheResult } from "@/lib/serverCache";
import { CONTRACTS } from "@/config/chain";
import { STAKING_PROTOCOLS } from "@/config/protocols";
import { fetchJsonWithRetry } from "@/lib/sourceFetch";
import { fetchTokenMarkets, type TokenMarket } from "@/services/tokenMarkets";
import { fetchCombinedYieldOpportunitiesWithMeta } from "@/services/yields-aggregator";

const ANALYTICS_CACHE_KEY = "analytics:monad:v8";
const ANALYTICS_TTL_MS = 5 * 60 * 1000;
const ANALYTICS_STALE_TTL_MS = 30 * 60 * 1000;
const DEFILLAMA_PAGE_SNAPSHOT_CACHE_KEY = "defillama:monad-page-snapshot:v1";
const DEFILLAMA_PAGE_SNAPSHOT_TTL_MS = 15 * 60 * 1000;
const DEFILLAMA_PAGE_SNAPSHOT_STALE_TTL_MS = 24 * 60 * 60 * 1000;
const MONAD_EPOCH_HOURS = 5.5;

const GMONADS_BASE_URL = "https://www.gmonads.com/api/v1/public";
const DEFILLAMA_MON_PRICE_URL = "https://coins.llama.fi/prices/current/coingecko:monad";
const COINGECKO_MON_URL =
  "https://api.coingecko.com/api/v3/coins/monad?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false";
const GECKO_WMON_TOKEN_URL =
  `https://api.geckoterminal.com/api/v2/networks/monad/tokens/${CONTRACTS.wmon}`;
const DEFILLAMA_STABLECOINS_URL = "https://stablecoins.llama.fi/stablecoins?chain=Monad";
const DEFILLAMA_STABLECOIN_CHART_URL = "https://stablecoins.llama.fi/stablecoincharts/Monad";
const DEFILLAMA_DEX_OVERVIEW_URL =
  "https://api.llama.fi/overview/dexs/Monad?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume";
const DEFILLAMA_FEES_OVERVIEW_URL =
  "https://api.llama.fi/overview/fees/Monad?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true";
const DEFILLAMA_CHAINS_URL = "https://api.llama.fi/v2/chains";
const DEFILLAMA_CHAIN_TVL_HISTORY_URL = "https://api.llama.fi/v2/historicalChainTvl/Monad";
const DEFILLAMA_PROTOCOLS_URL = "https://api.llama.fi/protocols";
const DEFILLAMA_YIELDS_URL = "https://yields.llama.fi/pools";
const DEFILLAMA_MONAD_PAGE_URL =
  "https://defillama.com/chain/monad?chainFees=true&perpsVolume=true&netInflows=true&activeAddresses=true&stablecoinsMcap=true";

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
    lockedOrStakedMon?: number;
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
    unbondingHours?: number;
    meanCommissionPct?: number;
    medianCommissionPct?: number;
    atCommissionCap?: number;
	  };
	  network: {
	    transactions1h?: number;
	    blocks1h?: number;
    activeAddresses?: number;
    newAddresses?: number;
	    epoch?: number;
	  };
	  economy: {
	    dailyFeesUsd?: number;
    chainFeesUsd?: number;
    chainRevenueUsd?: number;
    chainRevUsd?: number;
    tokenIncentivesUsd?: number;
    appRevenueUsd?: number;
    appFeesUsd?: number;
    userFeesUsd?: number;
    holdersRevenueUsd?: number;
    supplySideRevenueUsd?: number;
	    annualizedFeesUsd?: number;
	    psRatio?: number;
    pfRatio?: number;
    feeTrend: AnalyticsPoint[];
    chainRevenueTrend: AnalyticsPoint[];
    appRevenueTrend: AnalyticsPoint[];
    appFeesTrend: AnalyticsPoint[];
    userFeesTrend: AnalyticsPoint[];
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
    totalRaisedUsd?: number;
    bridgedTvlUsd?: number;
    rwaActiveMcapUsd?: number;
    tvlTrend: AnalyticsPoint[];
    volume30dTrend: AnalyticsPoint[];
  };
  stablecoins: {
    totalUsd: number;
    trend: AnalyticsPoint[];
    assets: AnalyticsStablecoin[];
  };
  derivatives: {
    perpsVolume24hUsd?: number;
    perpsVolume7dUsd?: number;
    perpsChange7dPct?: number;
    perpsVolumeTrend: AnalyticsPoint[];
  };
  flows: {
    netInflows24hUsd?: number;
    netInflowsTrend: AnalyticsPoint[];
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

interface DefiLlamaStablecoinChartPoint {
  date?: string | number;
  totalCirculating?: { peggedUSD?: number };
  totalCirculatingUSD?: { peggedUSD?: number };
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

interface DefiLlamaHistoricalChainTvlPoint {
  date?: number;
  tvl?: number;
}

interface DefiLlamaChain {
  name?: string;
  tvl?: number;
}

interface DefiLlamaProtocol {
  name?: string;
  category?: string;
  chains?: string[];
  chainTvls?: { Monad?: number };
  currentChainTvls?: { Monad?: number };
  tvl?: number;
}

interface DexTvlSummary {
  totalUsd: number;
  protocols: AnalyticsBar[];
}

interface DefiLlamaYieldResponse {
  data?: Array<{
    chain?: string;
    project?: string;
    symbol?: string;
    apy?: number;
  }>;
}

interface GmonadsResponse<T> {
  success?: boolean;
  data?: T;
}

interface GmonadsValidator {
  epoch?: string | number;
  val_index?: string | number;
  stake?: string | number;
  validator_set_type?: string;
  commission?: string | number;
  auth_address?: string;
  ip_address?: string;
}

interface GmonadsValidatorGeo extends GmonadsValidator {
  country?: string;
  countryCode?: string;
  city?: string;
  isp?: string;
  as?: string;
  connected?: boolean;
}

interface GmonadsValidatorMetadata {
  val_index?: string | number;
  name?: string;
  moniker?: string;
  validator_name?: string;
  website?: string;
  x?: string;
  twitter?: string;
}

interface GmonadsBlockPoint {
  bucket?: string;
  timestamp?: string;
  blocks?: string | number;
  txs?: string | number;
  avg_tps?: string | number;
  avg_bps?: string | number;
  avg_block_time_s?: string | number;
  total_base_fee?: string | number;
  total_priority_fee?: string | number;
}

interface GmonadsSnapshot {
  validators: GmonadsValidator[];
  geolocations: GmonadsValidatorGeo[];
  metadata: GmonadsValidatorMetadata[];
  blocks: GmonadsBlockPoint[];
}

interface DefiLlamaPageSnapshot {
  rwaActiveMcap?: number;
  chainFees?: {
    total24h?: number;
    feesGenerated24h?: number;
    totalREV24h?: number;
  };
  chainRevenue?: { total24h?: number };
  appRevenue?: { total24h?: number };
  appFees?: { total24h?: number };
  perps?: {
    total24h?: number;
    total7d?: number;
    change_7dover7d?: number;
  };
  users?: {
    activeUsers?: number | null;
    newUsers?: number | null;
    transactions?: number | null;
  };
  inflows?: {
    netInflows?: number;
  };
  chainRaises?: Array<{ amount?: number }>;
  chainAssets?: {
    total?: { total?: number };
  };
  chainIncentives?: {
    emissions24h?: number;
    emissions7d?: number;
    emissions30d?: number;
  };
}

interface ValidatorAnalyticsSummary {
  epoch?: number;
  activeValidators?: number;
  activeSetCap?: number;
  totalActiveStakeMon?: number;
  meanCommissionPct?: number;
  medianCommissionPct?: number;
  atCommissionCap?: number;
  nakamotoLiveness?: number;
  nakamotoSafety?: number;
  gini?: number;
  hhi?: number;
  top10SharePct?: number;
  countries: AnalyticsBar[];
  providers: AnalyticsBar[];
  validators: AnalyticsValidator[];
}

interface BlockStatsSummary {
  transactions1h?: number;
  blocks1h?: number;
  feeTrend: AnalyticsPoint[];
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
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

function latestStablecoinValue(points: AnalyticsPoint[]) {
  return points.at(-1)?.value || 0;
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

export function calculateEstimatedBurnRateMonPerDay(
  sampledBurnWei: bigint,
  sampledBlocks: bigint,
  blockTimeSeconds?: number
) {
  if (sampledBlocks <= 0n || !blockTimeSeconds || blockTimeSeconds <= 0) return undefined;
  const sampledBurnMon = Number(sampledBurnWei) / 1e18;
  if (!Number.isFinite(sampledBurnMon) || sampledBurnMon < 0) return undefined;
  const averageBurnPerBlock = sampledBurnMon / Number(sampledBlocks);
  return averageBurnPerBlock * (86400 / blockTimeSeconds);
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

async function fetchStablecoinTrend() {
  const data = await fetchJsonWithRetry<DefiLlamaStablecoinChartPoint[]>(DEFILLAMA_STABLECOIN_CHART_URL, {
    sourceName: "defillama-stablecoin-chart-monad",
    timeoutMs: 10_000,
    retries: 1,
  });

  return (data || [])
    .map((point) => ({
      timestamp: toNumber(point.date) || 0,
      value:
        toNumber(point.totalCirculatingUSD?.peggedUSD) ??
        toNumber(point.totalCirculating?.peggedUSD) ??
        0,
    }))
    .filter((point) => point.timestamp > 0 && point.value > 0);
}

async function fetchDexOverview() {
  return fetchJsonWithRetry<DefiLlamaOverviewResponse>(DEFILLAMA_DEX_OVERVIEW_URL, {
    sourceName: "defillama-dexs-monad",
    timeoutMs: 10_000,
    retries: 1,
  });
}

async function fetchFeesOverview(dataType = "dailyFees") {
  return fetchJsonWithRetry<DefiLlamaOverviewResponse>(`${DEFILLAMA_FEES_OVERVIEW_URL}&dataType=${dataType}`, {
    sourceName: `defillama-fees-monad-${dataType}`,
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

async function fetchChainTvlTrend() {
  const data = await fetchJsonWithRetry<DefiLlamaHistoricalChainTvlPoint[]>(DEFILLAMA_CHAIN_TVL_HISTORY_URL, {
    sourceName: "defillama-chain-tvl-history-monad",
    timeoutMs: 10_000,
    retries: 1,
  });

  return (data || [])
    .map((point) => ({
      timestamp: toNumber(point.date) || 0,
      value: toNumber(point.tvl) || 0,
    }))
    .filter((point) => point.timestamp > 0 && point.value > 0);
}

async function fetchTextWithRetry(url: string, sourceName: string, timeoutMs = 10_000) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= 1; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt === 1) break;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${sourceName}`);
}

function hasDefiLlamaPageSnapshotMetrics(snapshot: DefiLlamaPageSnapshot) {
  return Boolean(
    toNumber(snapshot.chainFees?.total24h) !== undefined ||
      toNumber(snapshot.chainRevenue?.total24h) !== undefined ||
      toNumber(snapshot.perps?.total24h) !== undefined ||
      toNumber(snapshot.users?.activeUsers) !== undefined ||
      toNumber(snapshot.inflows?.netInflows) !== undefined ||
      toNumber(snapshot.chainAssets?.total?.total) !== undefined ||
      toNumber(snapshot.rwaActiveMcap) !== undefined ||
      (snapshot.chainRaises?.length || 0) > 0
  );
}

async function fetchDefiLlamaPageSnapshotDirect(): Promise<DefiLlamaPageSnapshot> {
  const html = await fetchTextWithRetry(DEFILLAMA_MONAD_PAGE_URL, "defillama-monad-page");
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match?.[1]) throw new Error("DefiLlama page snapshot script was not found");
  const data = JSON.parse(match[1]) as {
    props?: { pageProps?: DefiLlamaPageSnapshot };
  };
  const snapshot = data.props?.pageProps || {};
  if (!hasDefiLlamaPageSnapshotMetrics(snapshot)) {
    throw new Error("DefiLlama page snapshot did not include Monad metric fields");
  }
  return snapshot;
}

async function fetchDefiLlamaPageSnapshot(): Promise<DefiLlamaPageSnapshot> {
  try {
    const result = await withServerCache(
      DEFILLAMA_PAGE_SNAPSHOT_CACHE_KEY,
      DEFILLAMA_PAGE_SNAPSHOT_TTL_MS,
      fetchDefiLlamaPageSnapshotDirect,
      DEFILLAMA_PAGE_SNAPSHOT_STALE_TTL_MS
    );
    return result.data;
  } catch {
    return {};
  }
}

async function fetchDexTvlSummary(): Promise<DexTvlSummary> {
  const protocols = await fetchJsonWithRetry<DefiLlamaProtocol[]>(DEFILLAMA_PROTOCOLS_URL, {
    sourceName: "defillama-protocols-dex-tvl",
    timeoutMs: 12_000,
    retries: 1,
  });

  const rows = protocols
    .filter((protocol) => protocol.category === "Dexs" && protocol.chains?.includes("Monad"))
    .map((protocol) => ({
      label: protocol.name || "Unknown",
      value:
        toNumber(protocol.currentChainTvls?.Monad) ??
        toNumber(protocol.chainTvls?.Monad) ??
        toNumber(protocol.tvl) ??
        0,
    }))
    .filter((protocol) => protocol.value > 0)
    .sort((a, b) => b.value - a.value);

  return {
    totalUsd: sum(rows.map((row) => row.value)),
    protocols: rows,
  };
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

async function fetchGmonadsData<T>(path: string, sourceName: string) {
  const data = await fetchJsonWithRetry<GmonadsResponse<T>>(
    `${GMONADS_BASE_URL}${path}${path.includes("?") ? "&" : "?"}network=mainnet`,
    {
      sourceName,
      timeoutMs: 10_000,
      retries: 1,
    }
  );
  return data.data;
}

async function fetchGmonadsSnapshot(): Promise<GmonadsSnapshot> {
  const [validators, geolocations, metadata, blocks] = await Promise.all([
    fetchGmonadsData<GmonadsValidator[]>("/validators/epoch", "gmonads-validators-epoch")
      .catch(() => []),
    fetchGmonadsData<GmonadsValidatorGeo[]>("/validators/geolocations", "gmonads-validators-geolocations")
      .catch(() => []),
    fetchGmonadsData<GmonadsValidatorMetadata[]>("/validators/metadata", "gmonads-validators-metadata")
      .catch(() => []),
    fetchGmonadsData<GmonadsBlockPoint[]>("/blocks/1m", "gmonads-blocks-1m")
      .catch(() => []),
  ]);

  return {
    validators: Array.isArray(validators) ? validators : [],
    geolocations: Array.isArray(geolocations) ? geolocations : [],
    metadata: Array.isArray(metadata) ? metadata : [],
    blocks: Array.isArray(blocks) ? blocks : [],
  };
}

function normalizeStakeMon(value: unknown) {
  const stake = toNumber(value);
  if (typeof stake !== "number") return 0;
  return stake > 1e15 ? stake / 1e18 : stake;
}

function normalizeCommissionPct(value: unknown) {
  const commission = toNumber(value);
  if (typeof commission !== "number") return 0;
  if (commission <= 100) return commission;
  if (commission <= 10_000) return commission / 100;
  return commission / 1e16;
}

function normalizeWeiToMon(value: unknown) {
  const wei = toNumber(value);
  if (typeof wei !== "number") return 0;
  return wei / 1e18;
}

function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] || 0) + (sorted[middle] || 0)) / 2
    : sorted[middle];
}

function gini(values: number[]) {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  const total = sum(sorted);
  if (sorted.length === 0 || total === 0) return undefined;
  const weighted = sorted.reduce((acc, value, index) => acc + (index + 1) * value, 0);
  return ((2 * weighted) / (sorted.length * total)) - ((sorted.length + 1) / sorted.length);
}

function nakamotoCoefficient(stakes: number[], thresholdPct: number) {
  const total = sum(stakes);
  if (total <= 0) return undefined;
  let running = 0;
  const sorted = [...stakes].sort((a, b) => b - a);
  for (let index = 0; index < sorted.length; index += 1) {
    running += sorted[index] || 0;
    if ((running / total) * 100 >= thresholdPct) return index + 1;
  }
  return sorted.length;
}

function aggregateByStake(
  rows: Array<{ label?: string; stakeMon: number }>,
  fallbackLabel: string
): AnalyticsBar[] {
  const totalStake = sum(rows.map((row) => row.stakeMon));
  const grouped = rows.reduce((map, row) => {
    const label = row.label || fallbackLabel;
    const current = map.get(label) || { stakeMon: 0, count: 0 };
    current.stakeMon += row.stakeMon;
    current.count += 1;
    map.set(label, current);
    return map;
  }, new Map<string, { stakeMon: number; count: number }>());

  return [...grouped.entries()]
    .map(([label, item]) => ({
      label,
      value: totalStake > 0 ? (item.stakeMon / totalStake) * 100 : item.count,
      detail: `${item.count} validators`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function buildValidatorAnalytics(snapshot: GmonadsSnapshot): ValidatorAnalyticsSummary {
  const metadataByIndex = new Map(
    snapshot.metadata.map((item) => [Number(item.val_index), item])
  );
  const geoByIndex = new Map(
    snapshot.geolocations.map((item) => [Number(item.val_index), item])
  );
  const sourceValidators = snapshot.validators.length > 0
    ? snapshot.validators
    : snapshot.geolocations;
  const active = sourceValidators
    .filter((validator) => !validator.validator_set_type || validator.validator_set_type === "active")
    .map((validator) => {
      const id = Number(validator.val_index || 0);
      const geo = geoByIndex.get(id);
      const meta = metadataByIndex.get(id);
      const stakeMon = normalizeStakeMon(validator.stake ?? geo?.stake);
      const commissionPct = normalizeCommissionPct(validator.commission ?? geo?.commission);
      return {
        id,
        stakeMon,
        commissionPct,
        epoch: toNumber(validator.epoch ?? geo?.epoch),
        name:
          meta?.name ||
          meta?.moniker ||
          meta?.validator_name ||
          (validator.auth_address ? `${validator.auth_address.slice(0, 6)}...${validator.auth_address.slice(-4)}` : `Validator ${id}`),
        website: meta?.website,
        x: meta?.x || meta?.twitter,
        country: geo?.country || geo?.countryCode,
        provider: geo?.isp || geo?.as,
      };
    })
    .filter((validator) => validator.stakeMon > 0)
    .sort((a, b) => b.stakeMon - a.stakeMon);

  const stakes = active.map((validator) => validator.stakeMon);
  const totalActiveStakeMon = sum(stakes);
  const commissions = active.map((validator) => validator.commissionPct);
  const top10SharePct =
    totalActiveStakeMon > 0 ? (sum(stakes.slice(0, 10)) / totalActiveStakeMon) * 100 : undefined;

  return {
    epoch: active.find((validator) => typeof validator.epoch === "number")?.epoch,
    activeValidators: active.length || undefined,
    activeSetCap: 200,
    totalActiveStakeMon: totalActiveStakeMon || undefined,
    meanCommissionPct: commissions.length ? sum(commissions) / commissions.length : undefined,
    medianCommissionPct: median(commissions),
    atCommissionCap: commissions.filter((commission) => commission >= 100).length,
    nakamotoLiveness: nakamotoCoefficient(stakes, 66.67),
    nakamotoSafety: nakamotoCoefficient(stakes, 33.34),
    gini: gini(stakes),
    hhi:
      totalActiveStakeMon > 0
        ? stakes.reduce((acc, stake) => acc + ((stake / totalActiveStakeMon) * 100) ** 2, 0)
        : undefined,
    top10SharePct,
    countries: aggregateByStake(
      active.map((validator) => ({ label: validator.country, stakeMon: validator.stakeMon })),
      "Unknown"
    ),
    providers: aggregateByStake(
      active.map((validator) => ({ label: validator.provider, stakeMon: validator.stakeMon })),
      "Unknown"
    ),
    validators: active.slice(0, 20).map((validator, index) => ({
      rank: index + 1,
      id: validator.id,
      name: validator.name,
      stakeMon: validator.stakeMon,
      sharePct: totalActiveStakeMon > 0 ? (validator.stakeMon / totalActiveStakeMon) * 100 : 0,
      commissionPct: validator.commissionPct,
      website: validator.website,
      x: validator.x,
    })),
  };
}

function buildBlockStats(blocks: GmonadsBlockPoint[]): BlockStatsSummary {
  const points = blocks
    .map((point) => {
      const timestamp = Date.parse(point.bucket || point.timestamp || "");
      return {
        timestamp: Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0,
        blocks: toNumber(point.blocks) || 0,
        txs: toNumber(point.txs) || 0,
        feesMon:
          normalizeWeiToMon(point.total_base_fee) +
          normalizeWeiToMon(point.total_priority_fee),
      };
	    })
	    .filter((point) => point.timestamp > 0)
	    .sort((a, b) => a.timestamp - b.timestamp);
	  const lastHour = points.slice(-60);

  return {
    transactions1h: sum(lastHour.map((point) => point.txs)),
    blocks1h: sum(lastHour.map((point) => point.blocks)),
    feeTrend: points.map((point) => ({
      timestamp: point.timestamp,
      value: point.feesMon,
    })),
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

function opportunityAnalyticsLabel(name: string, protocol: string) {
  const trimmedName = name.trim();
  const trimmedProtocol = protocol.trim();
  if (!trimmedProtocol) return trimmedName;
  if (trimmedName.toLowerCase().endsWith(` on ${trimmedProtocol.toLowerCase()}`)) {
    return trimmedName;
  }
  return `${trimmedName} on ${trimmedProtocol}`;
}

function compactUsdLabel(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

async function loadAnalytics(): Promise<AnalyticsPayload> {
  const [
    monPrice,
    priceTrend,
    gmonads,
    tokenMarkets,
    coinGeckoMonStats,
    monMarketStats,
    yieldOpportunities,
    stablecoins,
    stablecoinTrend,
    dexOverview,
    feesOverview,
    revenueOverview,
    appRevenueOverview,
    appFeesOverview,
    userFeesOverview,
    holdersRevenueOverview,
    supplySideRevenueOverview,
    chainTvl,
    chainTvlTrend,
    defillamaPageSnapshot,
    dexTvlSummary,
    stakingApySummary,
  ] = await Promise.all([
    fetchCurrentMonPrice().catch(() => undefined),
    fetchPriceTrend().catch(() => []),
    fetchGmonadsSnapshot().catch(() => ({
      validators: [],
      geolocations: [],
      metadata: [],
      blocks: [],
    })),
    fetchTokenMarkets().catch(() => ({
      data: {
        markets: [],
        pagesLoaded: 0,
        pagesExpected: 0,
        partial: true,
        warnings: ["Token market source unavailable."],
      },
    })),
    fetchCoinGeckoMonStats().catch(() => ({} as AnalyticsMarketStats)),
    fetchMonMarketStats().catch(() => ({} as AnalyticsMarketStats)),
    fetchCombinedYieldOpportunitiesWithMeta().catch(() => ({
      data: {
        opportunities: [],
        sources: [
          { name: "Merkl", ok: false, count: 0, error: "Unavailable" },
          { name: "DefiLlama", ok: false, count: 0, error: "Unavailable" },
        ],
      },
    })),
    fetchStablecoins().catch(() => ({ totalUsd: 0, assets: [] })),
    fetchStablecoinTrend().catch(() => []),
    fetchDexOverview().catch(() => ({} as DefiLlamaOverviewResponse)),
    fetchFeesOverview().catch(() => ({} as DefiLlamaOverviewResponse)),
    fetchFeesOverview("dailyRevenue").catch(() => ({} as DefiLlamaOverviewResponse)),
    fetchFeesOverview("dailyAppRevenue").catch(() => ({} as DefiLlamaOverviewResponse)),
    fetchFeesOverview("dailyAppFees").catch(() => ({} as DefiLlamaOverviewResponse)),
    fetchFeesOverview("dailyUserFees").catch(() => ({} as DefiLlamaOverviewResponse)),
    fetchFeesOverview("dailyHoldersRevenue").catch(() => ({} as DefiLlamaOverviewResponse)),
    fetchFeesOverview("dailySupplySideRevenue").catch(() => ({} as DefiLlamaOverviewResponse)),
    fetchChainTvl().catch(() => undefined),
    fetchChainTvlTrend().catch(() => []),
    fetchDefiLlamaPageSnapshot().catch(() => ({} as DefiLlamaPageSnapshot)),
    fetchDexTvlSummary().catch(() => ({ totalUsd: 0, protocols: [] })),
    fetchStakingApySummary().catch(() => ({})),
  ]);

  const markets = tokenMarkets.data.markets || [];
  const opportunities = yieldOpportunities.data.opportunities || [];
  const validatorAnalytics = buildValidatorAnalytics(gmonads);
  const blockStats = buildBlockStats(gmonads.blocks);
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
    .map((opportunity) => {
      const tvlLabel = compactUsdLabel(opportunity.tvl);
      return {
        label: opportunityAnalyticsLabel(opportunity.name, opportunity.protocol),
        value: opportunity.apr,
        detail: [
          opportunity.opportunityType || opportunity.action,
          tvlLabel ? `${tvlLabel} TVL` : undefined,
        ].filter(Boolean).join(" · "),
      };
    });

  const dexLiquidityByProtocol = [...markets.reduce((map, market) => {
    map.set(market.dexLabel, (map.get(market.dexLabel) || 0) + (market.liquidityUsd || 0));
    return map;
  }, new Map<string, number>())]
    .map(([label, value]) => ({ label, value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const topDexLiquidity =
    dexTvlSummary.protocols.length > 0
      ? dexTvlSummary.protocols.slice(0, 6)
      : dexLiquidityByProtocol.slice(0, 6);
  const dexTvlUsd =
    dexTvlSummary.totalUsd ||
    sum(dexLiquidityByProtocol.map((item) => item.value));
  const dexVolume24hUsd = toNumber(dexOverview.total24h);
  const dexFees24hUsd = toNumber(feesOverview.total24h);
  const chainFeesUsd =
    toNumber(defillamaPageSnapshot.chainFees?.total24h) ??
    toNumber(feesOverview.total24h);
  const chainRevenueUsd =
    toNumber(defillamaPageSnapshot.chainRevenue?.total24h) ??
    toNumber(revenueOverview.total24h);
  const chainRevUsd =
    toNumber(defillamaPageSnapshot.chainFees?.totalREV24h) ??
    chainFeesUsd;
  const appRevenueUsd =
    toNumber(defillamaPageSnapshot.appRevenue?.total24h) ??
    toNumber(appRevenueOverview.total24h);
  const appFeesUsd =
    toNumber(defillamaPageSnapshot.appFees?.total24h) ??
    toNumber(appFeesOverview.total24h);
  const tokenIncentivesUsd = toNumber(defillamaPageSnapshot.chainIncentives?.emissions24h);
  const dailyFeesUsd =
    toNumber(defillamaPageSnapshot.chainFees?.feesGenerated24h) ??
    toNumber(feesOverview.total24h) ??
    dexFees24hUsd;
  const annualizedFeesUsd =
    typeof dailyFeesUsd === "number" ? dailyFeesUsd * 365 : undefined;
  const marketCapUsd = resolvedMonMarket.marketCapUsd;
  const monPriceUsd = monPrice ?? resolvedMonMarket.priceUsd;

  const dailyVolume = toPoints(dexOverview.totalDataChart).slice(-30);
  const totalRaisedUsd = sum((defillamaPageSnapshot.chainRaises || []).map((raise) => toNumber(raise.amount))) * 1_000_000;

  const activeStakeMon = validatorAnalytics.totalActiveStakeMon;
  const activeValidators = validatorAnalytics.activeValidators;

  return {
    generatedAt: Date.now(),
    sources: [
      "gmonads",
      "CoinGecko",
	      "DefiLlama",
      "DefiLlama page snapshot",
	      "GeckoTerminal",
	      "Merkl",
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
      activeSetCap: validatorAnalytics.activeSetCap,
      totalActiveStakeMon: activeStakeMon,
      totalValueStakedUsd:
        activeStakeMon && monPriceUsd
          ? activeStakeMon * monPriceUsd
          : undefined,
      activeNodes: activeValidators,
      unbondingHours: MONAD_EPOCH_HOURS,
      ...stakingApySummary,
      meanCommissionPct: validatorAnalytics.meanCommissionPct,
      medianCommissionPct: validatorAnalytics.medianCommissionPct,
      atCommissionCap: validatorAnalytics.atCommissionCap,
    },
	    network: {
	      transactions1h: blockStats.transactions1h,
	      blocks1h: blockStats.blocks1h,
      activeAddresses: toNumber(defillamaPageSnapshot.users?.activeUsers),
      newAddresses: toNumber(defillamaPageSnapshot.users?.newUsers),
	      epoch: validatorAnalytics.epoch,
	    },
	    economy: {
	      dailyFeesUsd,
      chainFeesUsd,
      chainRevenueUsd,
      chainRevUsd,
      tokenIncentivesUsd,
      appRevenueUsd,
      appFeesUsd,
      userFeesUsd: toNumber(userFeesOverview.total24h),
      holdersRevenueUsd: toNumber(holdersRevenueOverview.total24h),
      supplySideRevenueUsd: toNumber(supplySideRevenueOverview.total24h),
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
      chainRevenueTrend: toPoints(revenueOverview.totalDataChart).slice(-30),
      appRevenueTrend: toPoints(appRevenueOverview.totalDataChart).slice(-30),
      appFeesTrend: toPoints(appFeesOverview.totalDataChart).slice(-30),
      userFeesTrend: toPoints(userFeesOverview.totalDataChart).slice(-30),
    },
    decentralization: {
      nakamotoLiveness: validatorAnalytics.nakamotoLiveness,
      nakamotoSafety: validatorAnalytics.nakamotoSafety,
      gini: validatorAnalytics.gini,
      hhi: validatorAnalytics.hhi,
      top10SharePct: validatorAnalytics.top10SharePct,
      activeValidators,
      countries: validatorAnalytics.countries,
      providers: validatorAnalytics.providers,
    },
    defi: {
      totalTvlUsd: sum(opportunities.map((opportunity) => opportunity.tvl)),
      totalChainTvlUsd: chainTvl,
      protocolTvl,
      categoryTvl,
      topRates,
      topDexLiquidity,
      totalRaisedUsd: totalRaisedUsd || undefined,
      bridgedTvlUsd: toNumber(defillamaPageSnapshot.chainAssets?.total?.total),
      rwaActiveMcapUsd: toNumber(defillamaPageSnapshot.rwaActiveMcap),
      tvlTrend: chainTvlTrend.slice(-120),
      volume30dTrend: dailyVolume,
    },
    stablecoins: {
      ...stablecoins,
      totalUsd: stablecoins.totalUsd || latestStablecoinValue(stablecoinTrend),
      trend: stablecoinTrend.slice(-120),
    },
    derivatives: {
      perpsVolume24hUsd: toNumber(defillamaPageSnapshot.perps?.total24h),
      perpsVolume7dUsd: toNumber(defillamaPageSnapshot.perps?.total7d),
      perpsChange7dPct: toNumber(defillamaPageSnapshot.perps?.change_7dover7d),
      perpsVolumeTrend: [],
    },
    flows: {
      netInflows24hUsd: toNumber(defillamaPageSnapshot.inflows?.netInflows),
      netInflowsTrend: [],
    },
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
    validators: validatorAnalytics.validators,
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
