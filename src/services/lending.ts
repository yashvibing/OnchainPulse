import { formatUnits, getAddress } from "viem";
import { monadClient } from "@/lib/client";
import { ERC4626_ABI, EULER_VAULT_ABI } from "@/lib/abis";
import {
  LENDING_PROTOCOLS,
  MORPHO_VAULTS,
  type LendingProtocol,
  type MorphoVault,
} from "@/config/protocols";
import { TOKENS } from "@/config/tokens";
import { fetchTokenPrices } from "./tokens";
import { getProtocolApy } from "./yields";

// ─── Types ───

export interface LendingPosition {
  protocol: string;
  type: "supply" | "borrow";
  asset: string;
  balance: string;
  valueUsd: number;
  apy: number;
  color: string;
}

// ─── Fetch Euler vault positions ───
// Euler vaults are ERC-4626 compatible with an additional debtOf method
async function fetchEulerPositions(
  protocol: LendingProtocol,
  walletAddress: `0x${string}`,
  prices: Map<string, number>,
  apy: number
): Promise<LendingPosition[]> {
  const positions: LendingPosition[] = [];
  const normalizedVault = getAddress(protocol.address);
  const normalizedWallet = getAddress(walletAddress);

  try {
    // Check supply (ERC-4626 share balance)
    const shares = await monadClient.readContract({
      address: normalizedVault,
      abi: ERC4626_ABI,
      functionName: "balanceOf",
      args: [normalizedWallet],
    });

    if (shares > 0n) {
      let assets: bigint;
      try {
        assets = await monadClient.readContract({
          address: normalizedVault,
          abi: ERC4626_ABI,
          functionName: "convertToAssets",
          args: [shares],
        });
      } catch {
        assets = shares;
      }

      const formatted = formatUnits(assets, 18);
      const price = prices.get("MON") || 0;

      positions.push({
        protocol: protocol.name,
        type: "supply",
        asset: "MON",
        balance: formatted,
        valueUsd: parseFloat(formatted) * price,
        apy,
        color: protocol.color,
      });
    }

    // Check borrow (debtOf)
    const debt = await monadClient.readContract({
      address: normalizedVault,
      abi: EULER_VAULT_ABI,
      functionName: "debtOf",
      args: [normalizedWallet],
    });

    if (debt > 0n) {
      const formatted = formatUnits(debt, 18);
      const price = prices.get("MON") || 0;

      positions.push({
        protocol: protocol.name,
        type: "borrow",
        asset: "MON",
        balance: formatted,
        valueUsd: parseFloat(formatted) * price,
        apy: 0,
        color: protocol.color,
      });
    }
  } catch (err) {
    console.error(`Failed to fetch ${protocol.name} positions:`, err);
  }

  return positions;
}

// ─── Morpho MetaMorpho Vaults ───
//
// MetaMorpho vaults are standard ERC-4626 wrappers around Morpho Blue lending
// markets. Users hold vault shares and the vault manager rebalances across
// underlying markets. From the user's perspective: deposit asset → earn yield.
// This is the dominant Morpho UX for retail.
//
// Vault discovery is dynamic: we query Morpho's GraphQL API at runtime for the
// top N vaults by TVL on Monad. If that API is down or returns nothing, we
// fall back to the static MORPHO_VAULTS snapshot in src/config/protocols.ts.
// The static list is now a safety net, not the primary source — new vaults
// will appear automatically as they're indexed by Morpho.

// Stable color assignment by underlying asset, so vaults of the same asset
// share a color across runs. Falls back to a neutral indigo for unknowns.
function colorForAsset(symbol: string): string {
  switch (symbol) {
    case "WETH":
      return "#7C3AED";
    case "cbBTC":
    case "WBTC":
      return "#F59E0B";
    case "USDC":
      return "#2775CA";
    case "AUSD":
      return "#1A73E8";
    case "USDT0":
      return "#26A17B";
    case "USD1":
      return "#FCD34D";
    case "WMON":
    case "MON":
      return "#6D3BF5";
    default:
      return "#94A3B8";
  }
}

// A vault entry enriched with the live netApy from the API. Same shape as
// MorphoVault but with the APY baked in to avoid a second round-trip.
interface VaultWithApy extends MorphoVault {
  netApy: number; // fraction (0.0626 = 6.26%)
}

// Hit Morpho's GraphQL API for the top vaults on Monad, ordered by TVL.
// Returns null on failure so callers can fall back to the static list.
async function fetchTopMorphoVaults(
  limit = 20
): Promise<VaultWithApy[] | null> {
  try {
    const query = `{
      vaults(
        where: {chainId_in: [143], totalAssetsUsd_gte: 1000}
        first: ${limit}
        orderBy: TotalAssetsUsd
        orderDirection: Desc
      ) {
        items {
          address
          symbol
          name
          asset { symbol }
          state { netApy }
        }
      }
    }`;
    const res = await fetch("https://blue-api.morpho.org/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
      next: { revalidate: 300 }, // cache 5 min
    });
    if (!res.ok) {
      console.warn(`Morpho API returned ${res.status}, using static list`);
      return null;
    }
    const data = await res.json();
    const items = data?.data?.vaults?.items;
    if (!Array.isArray(items) || items.length === 0) {
      console.warn("Morpho API returned no vaults, using static list");
      return null;
    }
    const out: VaultWithApy[] = [];
    for (const item of items) {
      const addr = item?.address;
      const sym = item?.asset?.symbol;
      if (!addr || !sym) continue;
      // Skip vaults whose underlying asset we don't have in TOKENS — we'd
      // have no way to price them. Most top vaults use known assets.
      if (!Object.values(TOKENS).find((t) => t.symbol === sym)) {
        console.warn(
          `Morpho vault ${item.symbol} (${addr}) uses unknown asset ${sym}, skipping`
        );
        continue;
      }
      out.push({
        name: item.name || item.symbol || "Morpho Vault",
        symbol: item.symbol || "vault",
        address: addr as `0x${string}`,
        underlyingSymbol: sym,
        color: colorForAsset(sym),
        netApy: typeof item?.state?.netApy === "number" ? item.state.netApy : 0,
      });
    }
    return out;
  } catch (err) {
    console.error("Failed to fetch Morpho vaults dynamically:", err);
    return null;
  }
}

async function fetchMorphoVaultPositions(
  walletAddress: `0x${string}`,
  prices: Map<string, number>,
  vaults: VaultWithApy[]
): Promise<LendingPosition[]> {
  if (vaults.length === 0) return [];
  const normalizedWallet = getAddress(walletAddress);

  // Batch 1: balanceOf for every vault.
  const balanceCalls = vaults.map((v) => ({
    address: getAddress(v.address),
    abi: ERC4626_ABI,
    functionName: "balanceOf" as const,
    args: [normalizedWallet] as const,
  }));
  const balanceResults = await monadClient.multicall({
    contracts: balanceCalls,
  });

  // Collect vaults with non-zero balances. Only these need a second round-trip.
  const heldVaults: { vault: VaultWithApy; shares: bigint }[] = [];
  balanceResults.forEach((r, i) => {
    if (r.status === "success" && (r.result as bigint) > 0n) {
      heldVaults.push({ vault: vaults[i], shares: r.result as bigint });
    }
  });
  if (heldVaults.length === 0) return [];

  // Batch 2: convertToAssets for each held vault to get the underlying value.
  const assetsCalls = heldVaults.map(({ vault, shares }) => ({
    address: getAddress(vault.address),
    abi: ERC4626_ABI,
    functionName: "convertToAssets" as const,
    args: [shares] as const,
  }));
  const assetsResults = await monadClient.multicall({
    contracts: assetsCalls,
  });

  const positions: LendingPosition[] = [];
  heldVaults.forEach(({ vault, shares }, i) => {
    const r = assetsResults[i];
    // Fall back to share count if convertToAssets fails — better to show
    // *something* than to silently drop a real position.
    const assetAmount = r.status === "success" ? (r.result as bigint) : shares;

    const tokenInfo = Object.values(TOKENS).find(
      (t) => t.symbol === vault.underlyingSymbol
    );
    const decimals = tokenInfo?.decimals ?? 18;
    const formatted = formatUnits(assetAmount, decimals);
    const price = prices.get(vault.underlyingSymbol) || 0;
    const valueUsd = parseFloat(formatted) * price;
    // vault.netApy is a fraction (0.0626). We display as %, so × 100.
    const apy = (vault.netApy || 0) * 100;

    positions.push({
      protocol: `Morpho · ${vault.name}`,
      type: "supply",
      asset: vault.underlyingSymbol,
      balance: formatted,
      valueUsd,
      apy,
      color: vault.color,
    });
  });

  return positions;
}

// Build a VaultWithApy[] from the static MORPHO_VAULTS snapshot. Used as
// the safety-net path when the live Morpho API is unreachable. APY is 0 in
// this path because we have no source of truth offline — better to show
// "0% APY" than to display a stale hardcoded number that the user might
// trust as current.
function staticMorphoVaultsAsFallback(): VaultWithApy[] {
  return MORPHO_VAULTS.map((v) => ({ ...v, netApy: 0 }));
}

// ─── Fetch all lending positions ───
export async function fetchLendingPositions(
  walletAddress: `0x${string}`
): Promise<LendingPosition[]> {
  const [prices, dynamicVaults, eulerApy] = await Promise.all([
    fetchTokenPrices(),
    fetchTopMorphoVaults(20),
    getProtocolApy("euler").catch(() => 0),
  ]);

  const vaultsToCheck = dynamicVaults ?? staticMorphoVaultsAsFallback();
  if (dynamicVaults === null) {
    console.warn(
      `Using static MORPHO_VAULTS fallback (${vaultsToCheck.length} vaults)`
    );
  }

  const allPositions: LendingPosition[] = [];

  // Morpho MetaMorpho vaults — most users have positions here, not in
  // raw Morpho Blue markets.
  const morphoPositions = await fetchMorphoVaultPositions(
    walletAddress,
    prices,
    vaultsToCheck
  );
  allPositions.push(...morphoPositions);

  for (const protocol of LENDING_PROTOCOLS) {
    if (protocol.type === "euler") {
      const positions = await fetchEulerPositions(
        protocol,
        walletAddress,
        prices,
        eulerApy
      );
      allPositions.push(...positions);
    }
  }

  return allPositions;
}
