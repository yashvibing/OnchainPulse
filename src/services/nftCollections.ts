import { withServerCache, type CacheResult } from "@/lib/serverCache";
import { fetchJsonWithRetry } from "@/lib/sourceFetch";

const OPENSEA_API_BASE = "https://api.opensea.io/api/v2";
const NFT_COLLECTIONS_CACHE_KEY = "nft-collections:monad:v1";
const NFT_COLLECTIONS_TTL_MS = 15 * 60 * 1000;
const NFT_COLLECTIONS_STALE_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_COLLECTIONS = 40;

interface OpenSeaContract {
  address?: string;
  chain?: string;
}

interface OpenSeaCollection {
  collection?: string;
  slug?: string;
  name?: string;
  description?: string;
  image_url?: string;
  banner_image_url?: string;
  owner?: string;
  safelist_status?: string;
  category?: string;
  is_disabled?: boolean;
  is_nsfw?: boolean;
  opensea_url?: string;
  contracts?: OpenSeaContract[];
  stats?: unknown;
}

interface OpenSeaCollectionsResponse {
  collections?: OpenSeaCollection[];
  next?: string | null;
}

interface OpenSeaStatsResponse {
  total?: Record<string, unknown>;
  intervals?: Array<Record<string, unknown>>;
}

interface OpenSeaFloorPricesResponse {
  floor_prices?: Array<Record<string, unknown>>;
}

interface OpenSeaOfferAggregatesResponse {
  offer_aggregations?: Array<Record<string, unknown>>;
}

interface OpenSeaEventsResponse {
  asset_events?: Array<Record<string, unknown>>;
}

export interface NftCollection {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string;
  contractAddress?: string;
  floorPrice?: number;
  floorCurrency?: string;
  floorChange1dPct?: number;
  topOffer?: number;
  topOfferCurrency?: string;
  volume1d?: number;
  volumeCurrency?: string;
  sales1d?: number;
  totalNfts?: number;
  uniqueOwners?: number;
  listedCount?: number;
  listedPct?: number;
  ownerRatioPct?: number;
  marketplaceUrl: string;
  lastSalePrice?: number;
  lastSaleCurrency?: string;
  lastSaleAt?: string;
  source: "OpenSea";
}

function getOpenSeaApiKey() {
  return process.env.OPENSEA_API_KEY || "";
}

function openSeaHeaders() {
  const apiKey = getOpenSeaApiKey();
  return apiKey ? { "x-api-key": apiKey } : undefined;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function toStringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstNumber(source: unknown, keys: string[]) {
  if (!source || typeof source !== "object") return undefined;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const number = toNumber(record[key]);
    if (typeof number === "number") return number;
  }
  return undefined;
}

function firstString(source: unknown, keys: string[]) {
  if (!source || typeof source !== "object") return undefined;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const stringValue = toStringValue(record[key]);
    if (stringValue) return stringValue;
  }
  return undefined;
}

function findInterval(stats: OpenSeaStatsResponse, names: string[]) {
  return stats.intervals?.find((interval) => {
    const intervalName = String(interval.interval || interval.name || interval.window || "").toLowerCase();
    return names.some((name) => intervalName.includes(name));
  });
}

function normalizeCurrency(value?: string) {
  if (!value) return "MON";
  return value.toUpperCase().replace(/^WRAPPED MONAD$/u, "WMON");
}

function getCollectionSlug(collection: OpenSeaCollection) {
  return collection.collection || collection.slug || "";
}

function getCollectionContract(collection: OpenSeaCollection) {
  return collection.contracts?.find((contract) => contract.address)?.address;
}

function collectionMarketplaceUrl(collection: OpenSeaCollection, slug: string) {
  return collection.opensea_url || `https://opensea.io/collection/${slug}`;
}

async function fetchOpenSeaJson<T>(path: string, sourceName: string) {
  return fetchJsonWithRetry<T>(`${OPENSEA_API_BASE}${path}`, {
    sourceName,
    timeoutMs: 10_000,
    retries: 1,
    headers: openSeaHeaders(),
  });
}

async function fetchTopMonadCollections() {
  const queryVariants = [
    "/collections/top?chains=monad&limit=40&sort_by=one_day_volume",
    "/collections/top?chain=monad&limit=40&sort_by=one_day_volume",
    "/collections?chain=monad&limit=40",
  ];

  let lastError: unknown;
  for (const query of queryVariants) {
    try {
      const response = await fetchOpenSeaJson<OpenSeaCollectionsResponse>(
        query,
        "opensea-nft-collections"
      );
      if (response.collections?.length) return response.collections;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No Monad NFT collections returned");
}

async function fetchCollectionStats(slug: string) {
  return fetchOpenSeaJson<OpenSeaStatsResponse>(
    `/collections/${encodeURIComponent(slug)}/stats`,
    "opensea-nft-stats"
  ).catch(() => ({} as OpenSeaStatsResponse));
}

async function fetchCollectionFloor(slug: string) {
  return fetchOpenSeaJson<OpenSeaFloorPricesResponse>(
    `/collections/${encodeURIComponent(slug)}/floor_prices`,
    "opensea-nft-floor"
  ).catch(() => ({} as OpenSeaFloorPricesResponse));
}

async function fetchCollectionOffers(slug: string) {
  return fetchOpenSeaJson<OpenSeaOfferAggregatesResponse>(
    `/collections/${encodeURIComponent(slug)}/offer_aggregates`,
    "opensea-nft-offers"
  ).catch(() => ({} as OpenSeaOfferAggregatesResponse));
}

async function fetchLastSale(slug: string) {
  return fetchOpenSeaJson<OpenSeaEventsResponse>(
    `/events/collection/${encodeURIComponent(slug)}?event_type=sale&limit=1`,
    "opensea-nft-last-sale"
  ).catch(() => ({} as OpenSeaEventsResponse));
}

function parseFloorFromResponse(response: OpenSeaFloorPricesResponse) {
  const floor = response.floor_prices?.[0];
  if (!floor) return {};
  return {
    floorPrice: firstNumber(floor, ["price", "current_price", "floor_price", "value"]),
    floorCurrency: normalizeCurrency(
      firstString(floor, ["currency", "symbol", "payment_token_symbol", "asset"])
    ),
  };
}

function parseTopOffer(response: OpenSeaOfferAggregatesResponse) {
  const offer = response.offer_aggregations?.[0];
  if (!offer) return {};
  return {
    topOffer: firstNumber(offer, ["price", "best_offer", "value", "amount"]),
    topOfferCurrency: normalizeCurrency(
      firstString(offer, ["currency", "symbol", "payment_token_symbol", "asset"])
    ),
  };
}

function parseLastSale(response: OpenSeaEventsResponse) {
  const sale = response.asset_events?.[0];
  if (!sale) return {};
  const payment = (sale.payment || sale.payment_token || sale.total_price) as unknown;
  const price =
    firstNumber(payment, ["quantity", "price", "value", "amount"]) ||
    firstNumber(sale, ["total_price", "price", "payment_amount"]);

  return {
    lastSalePrice: price,
    lastSaleCurrency: normalizeCurrency(
      firstString(payment, ["symbol", "currency", "asset"]) ||
        firstString(sale, ["payment_token_symbol", "currency"])
    ),
    lastSaleAt: firstString(sale, ["event_timestamp", "created_date", "created_at"]),
  };
}

function parseStats(stats: OpenSeaStatsResponse) {
  const total = stats.total || {};
  const oneDay = findInterval(stats, ["one_day", "1d", "24h", "day"]);
  const floorPrice = firstNumber(total, ["floor_price", "floorPrice", "floor"]);
  const floorChange1dPct =
    firstNumber(oneDay, [
      "floor_price_change_percentage",
      "floor_price_change_pct",
      "floor_change_pct",
      "floor_change",
    ]) ?? firstNumber(total, ["one_day_floor_change", "floor_change_1d"]);
  const volume1d =
    firstNumber(oneDay, ["volume", "volume_usd", "sales_volume"]) ??
    firstNumber(total, ["one_day_volume", "volume_1d"]);
  const sales1d =
    firstNumber(oneDay, ["sales", "sales_count", "num_sales"]) ??
    firstNumber(total, ["one_day_sales", "sales_1d"]);
  const totalNfts = firstNumber(total, ["total_supply", "totalSupply", "supply", "count"]);
  const uniqueOwners = firstNumber(total, ["num_owners", "numOwners", "owners", "owner_count"]);
  const listedCount = firstNumber(total, ["num_listed", "numListed", "listed_count", "listed"]);

  return {
    floorPrice,
    floorCurrency: normalizeCurrency(firstString(total, ["floor_price_symbol", "floor_currency"])),
    floorChange1dPct,
    volume1d,
    volumeCurrency: "MON",
    sales1d,
    totalNfts,
    uniqueOwners,
    listedCount,
    listedPct:
      typeof listedCount === "number" && typeof totalNfts === "number" && totalNfts > 0
        ? (listedCount / totalNfts) * 100
        : undefined,
    ownerRatioPct:
      typeof uniqueOwners === "number" && typeof totalNfts === "number" && totalNfts > 0
        ? (uniqueOwners / totalNfts) * 100
        : undefined,
  };
}

async function hydrateCollection(collection: OpenSeaCollection): Promise<NftCollection | undefined> {
  const slug = getCollectionSlug(collection);
  if (!slug || collection.is_disabled || collection.is_nsfw) return undefined;

  const [stats, floor, offers, lastSale] = await Promise.all([
    fetchCollectionStats(slug),
    fetchCollectionFloor(slug),
    fetchCollectionOffers(slug),
    fetchLastSale(slug),
  ]);

  const parsedStats = parseStats(stats);
  const parsedFloor = parseFloorFromResponse(floor);
  const parsedOffer = parseTopOffer(offers);
  const parsedLastSale = parseLastSale(lastSale);
  const floorPrice = parsedFloor.floorPrice ?? parsedStats.floorPrice;

  return {
    id: slug,
    slug,
    name: collection.name || slug,
    imageUrl: collection.image_url,
    contractAddress: getCollectionContract(collection),
    floorPrice,
    floorCurrency: parsedFloor.floorCurrency || parsedStats.floorCurrency || "MON",
    floorChange1dPct: parsedStats.floorChange1dPct,
    topOffer: parsedOffer.topOffer,
    topOfferCurrency: parsedOffer.topOfferCurrency || "MON",
    volume1d: parsedStats.volume1d,
    volumeCurrency: parsedStats.volumeCurrency || "MON",
    sales1d: parsedStats.sales1d,
    totalNfts: parsedStats.totalNfts,
    uniqueOwners: parsedStats.uniqueOwners,
    listedCount: parsedStats.listedCount,
    listedPct: parsedStats.listedPct,
    ownerRatioPct: parsedStats.ownerRatioPct,
    marketplaceUrl: collectionMarketplaceUrl(collection, slug),
    ...parsedLastSale,
    source: "OpenSea",
  };
}

async function loadNftCollections() {
  if (!getOpenSeaApiKey()) {
    throw new Error("OPENSEA_API_KEY is not configured");
  }

  const collections = await fetchTopMonadCollections();
  const hydrated = await Promise.all(collections.slice(0, MAX_COLLECTIONS).map(hydrateCollection));

  return hydrated
    .filter((collection): collection is NftCollection => Boolean(collection))
    .sort((a, b) => (b.volume1d || 0) - (a.volume1d || 0));
}

export async function fetchNftCollections(): Promise<CacheResult<NftCollection[]>> {
  return withServerCache(
    NFT_COLLECTIONS_CACHE_KEY,
    NFT_COLLECTIONS_TTL_MS,
    loadNftCollections,
    NFT_COLLECTIONS_STALE_TTL_MS
  );
}
