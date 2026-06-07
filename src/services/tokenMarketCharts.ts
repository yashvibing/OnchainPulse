import { withServerCache, type CacheResult } from "@/lib/serverCache";
import { fetchJsonWithRetry } from "@/lib/sourceFetch";

export type TokenChartRange = "24h" | "7d" | "30d";
export type TokenChartSide = "base" | "quote";

export interface TokenChartPoint {
  timestamp: number;
  value: number;
  volumeUsd?: number;
}

interface GeckoOhlcvResponse {
  data?: {
    attributes?: {
      ohlcv_list?: Array<[number, number, number, number, number, number]>;
    };
  };
}

const CHART_TTL_MS = 5 * 60 * 1000;
const CHART_STALE_TTL_MS = 30 * 60 * 1000;

const RANGE_CONFIG: Record<
  TokenChartRange,
  { timeframe: "minute" | "hour" | "day"; aggregate: number; limit: number }
> = {
  "24h": { timeframe: "minute", aggregate: 15, limit: 96 },
  "7d": { timeframe: "hour", aggregate: 4, limit: 42 },
  "30d": { timeframe: "day", aggregate: 1, limit: 30 },
};

function normalizePoolAddress(poolAddress: string) {
  return poolAddress.trim().toLowerCase();
}

async function loadTokenMarketChart(
  poolAddress: string,
  range: TokenChartRange,
  side: TokenChartSide
) {
  const config = RANGE_CONFIG[range];
  const url = new URL(
    `https://api.geckoterminal.com/api/v2/networks/monad/pools/${normalizePoolAddress(poolAddress)}/ohlcv/${config.timeframe}`
  );
  url.searchParams.set("aggregate", String(config.aggregate));
  url.searchParams.set("limit", String(config.limit));
  url.searchParams.set("currency", "usd");
  url.searchParams.set("token", side);

  const response = await fetchJsonWithRetry<GeckoOhlcvResponse>(url.toString(), {
    sourceName: "geckoterminal-token-market-chart",
    timeoutMs: 8_000,
    retries: 1,
  });

  return (response.data?.attributes?.ohlcv_list || [])
    .map(([timestamp, , , , close, volumeUsd]) => ({
      timestamp,
      value: Number(close),
      volumeUsd: Number(volumeUsd),
    }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function fetchTokenMarketChart(
  poolAddress: string,
  range: TokenChartRange,
  side: TokenChartSide
): Promise<CacheResult<TokenChartPoint[]>> {
  const normalizedPool = normalizePoolAddress(poolAddress);
  return withServerCache(
    `token-market-chart:monad:${normalizedPool}:${range}:${side}`,
    CHART_TTL_MS,
    () => loadTokenMarketChart(normalizedPool, range, side),
    CHART_STALE_TTL_MS
  );
}

export function isTokenChartRange(value: string | null): value is TokenChartRange {
  return value === "24h" || value === "7d" || value === "30d";
}

export function isTokenChartSide(value: string | null): value is TokenChartSide {
  return value === "base" || value === "quote";
}
