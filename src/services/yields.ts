// ─── DefiLlama Yields API ───
// Free, no API key needed. Returns APY data for all DeFi pools.

export interface YieldPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number;
  apyReward: number;
}

let cachedPools: YieldPool[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 300_000; // 5 minutes

export async function fetchMonadYields(): Promise<YieldPool[]> {
  const now = Date.now();
  if (cachedPools && now - cacheTime < CACHE_TTL) {
    return cachedPools;
  }

  try {
    const res = await fetch("https://yields.llama.fi/pools");
    const { data } = await res.json();

    cachedPools = data.filter(
      (pool: YieldPool) => pool.chain === "Monad"
    );
    cacheTime = now;

    return cachedPools!;
  } catch (err) {
    console.error("Failed to fetch yields:", err);
    return cachedPools || [];
  }
}

// Helper: get best yield for a specific protocol. Optional symbolFilter
// disambiguates when one project has multiple pools (e.g. Upshift has both
// earnAUSD and earnMON).
export async function getProtocolApy(
  protocolName: string,
  symbolFilter?: string
): Promise<number> {
  const pools = await fetchMonadYields();
  const match = pools.find((p) => {
    if (!p.project.toLowerCase().includes(protocolName.toLowerCase()))
      return false;
    if (
      symbolFilter &&
      !(p.symbol || "").toLowerCase().includes(symbolFilter.toLowerCase())
    )
      return false;
    return true;
  });
  return match?.apy || 0;
}

// Helper: get all yield opportunities sorted by APY
export async function getTopYields(limit: number = 20): Promise<YieldPool[]> {
  const pools = await fetchMonadYields();
  return pools
    .filter((p) => p.apy > 0 && p.tvlUsd > 1000)
    .sort((a, b) => b.apy - a.apy)
    .slice(0, limit);
}
