import { withServerCache, type CacheResult } from "@/lib/serverCache";
import { fetchJsonWithRetry } from "@/lib/sourceFetch";
import { getErrorMessage, logServerEvent } from "@/lib/serverLog";

const GECKO_MONAD_POOLS_URL = "https://api.geckoterminal.com/api/v2/networks/monad/pools";
const TOKEN_MARKETS_CACHE_KEY = "token-markets:monad:v2";
const TOKEN_MARKETS_TTL_MS = 5 * 60 * 1000;
const TOKEN_MARKETS_STALE_TTL_MS = 30 * 60 * 1000;
const PAGES_TO_SCAN = 4;
const MIN_24H_VOLUME_USD = 100;
const PAGE_FETCH_DELAY_MS = 750;

interface GeckoToken {
  id: string;
  type: "token";
  attributes?: {
    address?: string;
    name?: string;
    symbol?: string;
    image_url?: string;
  };
}

interface GeckoPool {
  id: string;
  type: "pool";
  attributes?: {
    address?: string;
    name?: string;
    base_token_price_usd?: string | number | null;
    quote_token_price_usd?: string | number | null;
    fdv_usd?: string | number | null;
    market_cap_usd?: string | number | null;
    pool_created_at?: string | null;
    price_change_percentage?: {
      h24?: string | number | null;
      h6?: string | number | null;
      h1?: string | number | null;
    };
    volume_usd?: {
      h24?: string | number | null;
      h6?: string | number | null;
      h1?: string | number | null;
    };
    reserve_in_usd?: string | number | null;
  };
  relationships?: {
    base_token?: { data?: { id?: string } };
    quote_token?: { data?: { id?: string } };
    dex?: { data?: { id?: string } };
  };
}

interface GeckoPoolsResponse {
  data?: GeckoPool[];
  included?: GeckoToken[];
}

export interface TokenMarket {
  id: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenImageUrl?: string;
  priceUsd?: number;
  priceChange24h?: number;
  volume24hUsd?: number;
  liquidityUsd?: number;
  marketCapUsd?: number;
  fdvUsd?: number;
  dexId: string;
  dexLabel: string;
  poolAddress: string;
  poolName: string;
  poolUrl: string;
  chartTokenSide: "base" | "quote";
  quoteSymbol?: string;
  poolCreatedAt?: string;
  source: "GeckoTerminal";
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizeSymbol(symbol?: string) {
  return (symbol || "").trim().toUpperCase();
}

function dexLabelFromId(dexId?: string) {
  return (dexId || "unknown")
    .replace(/-monad$/u, "")
    .replace(/-/gu, " ")
    .replace(/\b\w/gu, (char) => char.toUpperCase());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tokenFromRelationship(pool: GeckoPool, tokens: Map<string, GeckoToken>, side: "base" | "quote") {
  const id = pool.relationships?.[`${side}_token`]?.data?.id;
  return id ? tokens.get(id) : undefined;
}

function pickMarketToken(pool: GeckoPool, tokens: Map<string, GeckoToken>) {
  const base = tokenFromRelationship(pool, tokens, "base");
  const quote = tokenFromRelationship(pool, tokens, "quote");
  const baseSymbol = normalizeSymbol(base?.attributes?.symbol);
  const quoteSymbol = normalizeSymbol(quote?.attributes?.symbol);

  if (baseSymbol) {
    return { token: base, side: "base" as const, quote };
  }

  if (quoteSymbol) {
    return { token: quote, side: "quote" as const, quote: base };
  }

  return undefined;
}

function poolToMarket(pool: GeckoPool, tokens: Map<string, GeckoToken>): TokenMarket | undefined {
  const picked = pickMarketToken(pool, tokens);
  const token = picked?.token;
  const attrs = pool.attributes;
  const tokenAttrs = token?.attributes;
  const symbol = normalizeSymbol(tokenAttrs?.symbol);
  const poolAddress = attrs?.address?.trim();

  if (!picked || !token || !attrs || !symbol || !poolAddress) return undefined;

  const priceUsd =
    picked.side === "base"
      ? toNumber(attrs.base_token_price_usd)
      : toNumber(attrs.quote_token_price_usd);
  const dexId = pool.relationships?.dex?.data?.id || "unknown";

  return {
    id: `${token.id}:${poolAddress}`,
    tokenAddress: tokenAttrs?.address || token.id.replace(/^monad_/u, ""),
    tokenName: tokenAttrs?.name || symbol,
    tokenSymbol: symbol,
    tokenImageUrl: tokenAttrs?.image_url,
    priceUsd,
    priceChange24h: toNumber(attrs.price_change_percentage?.h24),
    volume24hUsd: toNumber(attrs.volume_usd?.h24),
    liquidityUsd: toNumber(attrs.reserve_in_usd),
    marketCapUsd: toNumber(attrs.market_cap_usd),
    fdvUsd: toNumber(attrs.fdv_usd),
    dexId,
    dexLabel: dexLabelFromId(dexId),
    poolAddress,
    poolName: attrs.name || `${symbol} pool`,
    poolUrl: `https://www.geckoterminal.com/monad/pools/${poolAddress}`,
    chartTokenSide: picked.side,
    quoteSymbol: picked.quote?.attributes?.symbol,
    poolCreatedAt: attrs.pool_created_at || undefined,
    source: "GeckoTerminal",
  };
}

function betterMarket(current: TokenMarket, candidate: TokenMarket) {
  const currentScore = (current.volume24hUsd || 0) + (current.liquidityUsd || 0) * 0.2;
  const candidateScore = (candidate.volume24hUsd || 0) + (candidate.liquidityUsd || 0) * 0.2;
  return candidateScore > currentScore ? candidate : current;
}

async function fetchGeckoPoolsPage(page: number) {
  const url = new URL(GECKO_MONAD_POOLS_URL);
  url.searchParams.set("include", "base_token,quote_token");
  url.searchParams.set("page", String(page));

  return fetchJsonWithRetry<GeckoPoolsResponse>(url.toString(), {
    sourceName: "geckoterminal-token-markets",
    timeoutMs: 8_000,
    retries: 2,
    retryDelayMs: 1_200,
  });
}

async function loadTokenMarkets() {
  const pages: GeckoPoolsResponse[] = [];

  for (let page = 1; page <= PAGES_TO_SCAN; page += 1) {
    try {
      pages.push(await fetchGeckoPoolsPage(page));
    } catch (error) {
      logServerEvent("warn", "token_markets.page_failed", {
        page,
        loadedPages: pages.length,
        error: getErrorMessage(error),
      });

      if (pages.length === 0) throw error;
      break;
    }

    if (page < PAGES_TO_SCAN) await sleep(PAGE_FETCH_DELAY_MS);
  }

  const tokens = new Map<string, GeckoToken>();
  const deduped = new Map<string, TokenMarket>();

  pages.forEach((page) => {
    (page.included || []).forEach((token) => {
      if (token.id) tokens.set(token.id, token);
    });
  });

  pages.flatMap((page) => page.data || []).forEach((pool) => {
    const market = poolToMarket(pool, tokens);
    if (!market) return;

    const dedupeKey = market.tokenAddress.toLowerCase() || market.tokenSymbol;
    const existing = deduped.get(dedupeKey);
    deduped.set(dedupeKey, existing ? betterMarket(existing, market) : market);
  });

  return [...deduped.values()]
    .filter((market) => (market.volume24hUsd || 0) > MIN_24H_VOLUME_USD)
    .sort((a, b) => (b.volume24hUsd || 0) - (a.volume24hUsd || 0))
    .slice(0, 80);
}

export async function fetchTokenMarkets(): Promise<CacheResult<TokenMarket[]>> {
  return withServerCache(
    TOKEN_MARKETS_CACHE_KEY,
    TOKEN_MARKETS_TTL_MS,
    loadTokenMarkets,
    TOKEN_MARKETS_STALE_TTL_MS
  );
}
