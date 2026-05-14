import {
  fetchMerklYieldOpportunities,
  getOpportunityAssetSymbols,
  type YieldOpportunity,
} from "@/services/yields-aggregator";

const DEFILLAMA_PROTOCOLS_URL = "https://api.llama.fi/protocols";
const MONAD_CHAIN = "Monad";
const CANONICAL_ASSETS = new Set([
  "AUSD",
  "CBBTC",
  "GMON",
  "MON",
  "SHMON",
  "SMON",
  "USDC",
  "USDT0",
  "VUSD",
  "WBTC",
  "WETH",
  "WMON",
  "USD1",
]);

export interface MonadProject {
  id: string;
  name: string;
  slug: string;
  category: string;
  url: string;
  description: string;
  logo: string;
  tvlUsd: number;
  borrowedUsd: number;
  change1d: number | null;
  change7d: number | null;
  opportunityCount: number;
  bestApr: number | null;
  assets: string[];
  actions: ("LEND" | "BORROW")[];
}

export interface MonadMarket {
  id: string;
  asset: string;
  assetLabel: string;
  protocol: string;
  protocolSlug: string;
  protocolLogo: string;
  protocolUrl: string;
  category: string;
  opportunityName: string;
  action: "LEND" | "BORROW";
  depositsUsd: number | null;
  borrowedUsd: number;
  liquidityUsd: number | null;
  apy: number;
  baseApr: number;
  rewardApr: number;
  utilization: number | null;
  tokens: string[];
  detailUrl: string;
}

export interface MonadProjectsResponse {
  projects: MonadProject[];
  markets: MonadMarket[];
  totals: {
    tvlUsd: number;
    borrowedUsd: number;
    projectCount: number;
    opportunityCount: number;
    marketCount: number;
  };
  updatedAt: string;
  sourceStatus: {
    defiLlama: "live";
    merkl: "live";
  };
}

interface DefiLlamaProtocol {
  name?: string;
  slug?: string;
  category?: string;
  url?: string;
  description?: string;
  logo?: string;
  chains?: string[];
  chainTvls?: Record<string, number>;
  change_1d?: number;
  change_7d?: number;
}

let cache: { data: MonadProjectsResponse; ts: number } | null = null;
const CACHE_TTL = 300_000;

function normalizeProtocolName(name: string) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.includes("morpho")) return "morpho";
  if (normalized.includes("townsquare")) return "townsquare";
  if (normalized.includes("neverland")) return "neverland";
  if (normalized.includes("curvance")) return "curvance";
  if (normalized.includes("upshift")) return "upshift";
  if (normalized.includes("gearbox")) return "gearbox";
  if (normalized.includes("euler")) return "euler";
  if (normalized.includes("balancer")) return "balancer";
  return normalized;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function summarizeMerkl(opportunities: YieldOpportunity[]) {
  return {
    opportunityCount: opportunities.length,
    bestApr:
      opportunities.length > 0
        ? Math.max(...opportunities.map((opportunity) => opportunity.apr || 0))
        : null,
    assets: uniqueSorted(opportunities.flatMap(getOpportunityAssetSymbols)),
    actions: uniqueSorted(opportunities.map((opportunity) => opportunity.action)) as (
      | "LEND"
      | "BORROW"
    )[],
  };
}

function buildProjectFromDefiLlama(
  protocol: DefiLlamaProtocol,
  opportunities: YieldOpportunity[]
): MonadProject {
  const merkl = summarizeMerkl(opportunities);
  const name = protocol.name || "Unknown";
  const tvlUsd = protocol.chainTvls?.[MONAD_CHAIN] || 0;
  const borrowedUsd = protocol.chainTvls?.[`${MONAD_CHAIN}-borrowed`] || 0;

  return {
    id: protocol.slug || slugify(name),
    name,
    slug: protocol.slug || slugify(name),
    category: protocol.category || "Other",
    url: protocol.url || "",
    description: protocol.description || "",
    logo: protocol.logo || "",
    tvlUsd,
    borrowedUsd,
    change1d: protocol.change_1d ?? null,
    change7d: protocol.change_7d ?? null,
    ...merkl,
  };
}

function buildProjectFromMerkl(
  protocolName: string,
  opportunities: YieldOpportunity[]
): MonadProject {
  const merkl = summarizeMerkl(opportunities);
  const firstOpportunity = opportunities[0];
  const tvlUsd = opportunities
    .filter((opportunity) => opportunity.action === "LEND")
    .reduce((sum, opportunity) => sum + opportunity.tvl, 0);

  return {
    id: slugify(protocolName),
    name: protocolName,
    slug: slugify(protocolName),
    category: "Yield",
    url: firstOpportunity?.protocolUrl || firstOpportunity?.depositUrl || "",
    description: "Active Monad yield opportunities tracked by Merkl.",
    logo: firstOpportunity?.protocolIcon || "",
    tvlUsd,
    borrowedUsd: 0,
    change1d: null,
    change7d: null,
    ...merkl,
  };
}

function normalizeAssetForKey(asset: string) {
  return asset.replace(/-\d+$/u, "").toUpperCase();
}

function canonicalizeAsset(asset: string) {
  const normalized = normalizeAssetForKey(asset).replace(/-?DEBT$/u, "");
  if (CANONICAL_ASSETS.has(normalized)) return normalized;

  const strippedReceiptPrefix = normalized.replace(/^[CEN]/u, "");
  if (CANONICAL_ASSETS.has(strippedReceiptPrefix)) return strippedReceiptPrefix;

  if (normalized.startsWith("C") && normalized.length > 4) {
    return normalized.slice(1);
  }

  return normalized;
}

function getMarketAsset(opportunity: YieldOpportunity) {
  const assets = getOpportunityAssetSymbols(opportunity).map(canonicalizeAsset);
  const canonicalAsset = assets.find((asset) => CANONICAL_ASSETS.has(asset));
  if (canonicalAsset) return canonicalAsset;

  const cleanAssets = assets.filter(
    (asset) => !asset.endsWith("DEBT") && !asset.includes("-")
  );

  return cleanAssets[0] || assets[0] || "UNKNOWN";
}

function buildMarketKey(protocol: string, asset: string) {
  return `${normalizeProtocolName(protocol)}:${normalizeAssetForKey(asset)}`;
}

function buildMarkets(
  opportunities: YieldOpportunity[],
  projectsByProtocol: Map<string, MonadProject>
): MonadMarket[] {
  const borrowByMarket = new Map<string, number>();
  const lendKeys = new Set<string>();

  for (const opportunity of opportunities) {
    const asset = getMarketAsset(opportunity);
    const key = buildMarketKey(opportunity.protocol, asset);

    if (opportunity.action === "BORROW") {
      borrowByMarket.set(key, (borrowByMarket.get(key) || 0) + opportunity.tvl);
    } else {
      lendKeys.add(key);
    }
  }

  const markets: MonadMarket[] = [];

  for (const opportunity of opportunities) {
    const asset = getMarketAsset(opportunity);
    const key = buildMarketKey(opportunity.protocol, asset);
    const project = projectsByProtocol.get(normalizeProtocolName(opportunity.protocol));
    const borrowedUsd = borrowByMarket.get(key) || 0;
    const depositsUsd = opportunity.action === "LEND" ? opportunity.tvl : null;
    const liquidityUsd =
      depositsUsd !== null && borrowedUsd > 0 ? Math.max(depositsUsd - borrowedUsd, 0) : null;
    const utilization =
      depositsUsd !== null && borrowedUsd > 0 && depositsUsd > 0
        ? Math.min((borrowedUsd / depositsUsd) * 100, 100)
        : null;

    if (opportunity.action === "BORROW" && lendKeys.has(key)) continue;

    markets.push({
      id: `${opportunity.action}:${opportunity.id || opportunity.name}`,
      asset,
      assetLabel: asset,
      protocol: opportunity.protocol,
      protocolSlug: project?.slug || slugify(opportunity.protocol),
      protocolLogo: opportunity.protocolIcon || project?.logo || "",
      protocolUrl: opportunity.protocolUrl || project?.url || "",
      category: project?.category || "Yield",
      opportunityName: opportunity.name,
      action: opportunity.action,
      depositsUsd,
      borrowedUsd: opportunity.action === "BORROW" ? opportunity.tvl : borrowedUsd,
      liquidityUsd,
      apy: opportunity.apr,
      baseApr: opportunity.baseApr,
      rewardApr: opportunity.rewardApr,
      utilization,
      tokens: getOpportunityAssetSymbols(opportunity),
      detailUrl: opportunity.depositUrl || opportunity.protocolUrl || project?.url || "",
    });
  }

  return markets.sort((a, b) => {
    const depositsDiff = (b.depositsUsd || b.borrowedUsd) - (a.depositsUsd || a.borrowedUsd);
    if (depositsDiff !== 0) return depositsDiff;
    return b.apy - a.apy;
  });
}

export async function fetchMonadProjects(): Promise<MonadProjectsResponse> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;

  const [protocolsResponse, opportunities] = await Promise.all([
    fetch(DEFILLAMA_PROTOCOLS_URL),
    fetchMerklYieldOpportunities(),
  ]);

  if (!protocolsResponse.ok) {
    throw new Error("Failed to fetch DefiLlama protocols");
  }

  const protocols = (await protocolsResponse.json()) as DefiLlamaProtocol[];
  const opportunitiesByProtocol = new Map<string, YieldOpportunity[]>();

  for (const opportunity of opportunities) {
    if (!opportunity.protocol || opportunity.protocol === "Unknown") continue;
    const key = normalizeProtocolName(opportunity.protocol);
    const existing = opportunitiesByProtocol.get(key) || [];
    existing.push(opportunity);
    opportunitiesByProtocol.set(key, existing);
  }

  const projects: MonadProject[] = [];
  const matchedMerklKeys = new Set<string>();

  for (const protocol of protocols) {
    const name = protocol.name || "";
    const key = normalizeProtocolName(name);
    const tvlUsd = protocol.chainTvls?.[MONAD_CHAIN] || 0;
    const borrowedUsd = protocol.chainTvls?.[`${MONAD_CHAIN}-borrowed`] || 0;
    const hasMonadChain = protocol.chains?.includes(MONAD_CHAIN);
    const merklOpportunities = opportunitiesByProtocol.get(key) || [];

    if (!hasMonadChain && tvlUsd <= 0 && borrowedUsd <= 0 && merklOpportunities.length === 0) {
      continue;
    }

    matchedMerklKeys.add(key);
    projects.push(buildProjectFromDefiLlama(protocol, merklOpportunities));
  }

  for (const [key, protocolOpportunities] of opportunitiesByProtocol) {
    if (matchedMerklKeys.has(key)) continue;
    projects.push(buildProjectFromMerkl(protocolOpportunities[0].protocol, protocolOpportunities));
  }

  projects.sort((a, b) => {
    const tvlDiff = b.tvlUsd - a.tvlUsd;
    if (tvlDiff !== 0) return tvlDiff;
    return b.opportunityCount - a.opportunityCount;
  });

  const projectsByProtocol = new Map(
    projects.map((project) => [normalizeProtocolName(project.name), project])
  );
  const markets = buildMarkets(opportunities, projectsByProtocol);

  const totals = {
    tvlUsd: projects.reduce((sum, project) => sum + project.tvlUsd, 0),
    borrowedUsd: projects.reduce((sum, project) => sum + project.borrowedUsd, 0),
    projectCount: projects.length,
    opportunityCount: opportunities.length,
    marketCount: markets.length,
  };

  const data = {
    projects,
    markets,
    totals,
    updatedAt: new Date().toISOString(),
    sourceStatus: {
      defiLlama: "live" as const,
      merkl: "live" as const,
    },
  };
  cache = { data, ts: Date.now() };
  return data;
}
