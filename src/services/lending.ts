import { formatUnits, getAddress } from "viem";
import { monadClient } from "@/lib/client";
import { ERC20_ABI, ERC4626_ABI, EULER_VAULT_ABI } from "@/lib/abis";
import {
  LENDING_PROTOCOLS,
  MORPHO_VAULTS,
  NEVERLAND_RESERVES,
  CURVANCE_MARKETS,
  EULER_VAULTS,
  GEARBOX_VAULTS,
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

// ─── Neverland (Aave V3 fork) ───
// aTokens are rebasing ERC-20s: balanceOf(user) = supply + accrued interest.
// variableDebtTokens: balanceOf(user) = borrow amount + accrued interest.
// No conversion needed — the balance IS the underlying amount.

async function fetchNeverlandPositions(
  walletAddress: `0x${string}`,
  prices: Map<string, number>
): Promise<LendingPosition[]> {
  if (NEVERLAND_RESERVES.length === 0) return [];
  const normalizedWallet = getAddress(walletAddress);

  // Batch: balanceOf on every aToken + every debtToken in one multicall.
  const calls = [
    ...NEVERLAND_RESERVES.map((r) => ({
      address: getAddress(r.aToken),
      abi: ERC20_ABI,
      functionName: "balanceOf" as const,
      args: [normalizedWallet] as const,
    })),
    ...NEVERLAND_RESERVES.map((r) => ({
      address: getAddress(r.variableDebtToken),
      abi: ERC20_ABI,
      functionName: "balanceOf" as const,
      args: [normalizedWallet] as const,
    })),
  ];
  const results = await monadClient.multicall({ contracts: calls });
  const n = NEVERLAND_RESERVES.length;

  const positions: LendingPosition[] = [];
  for (let i = 0; i < n; i++) {
    const reserve = NEVERLAND_RESERVES[i];
    const supplyResult = results[i];
    const debtResult = results[n + i];

    if (supplyResult.status === "success" && (supplyResult.result as bigint) > 0n) {
      const formatted = formatUnits(supplyResult.result as bigint, reserve.decimals);
      const price = prices.get(reserve.asset) || 0;
      positions.push({
        protocol: `Neverland · ${reserve.asset}`,
        type: "supply",
        asset: reserve.asset,
        balance: formatted,
        valueUsd: parseFloat(formatted) * price,
        apy: 0, // filled below from DefiLlama
        color: "#8B5CF6",
      });
    }

    if (debtResult.status === "success" && (debtResult.result as bigint) > 0n) {
      const formatted = formatUnits(debtResult.result as bigint, reserve.decimals);
      const price = prices.get(reserve.asset) || 0;
      positions.push({
        protocol: `Neverland · ${reserve.asset}`,
        type: "borrow",
        asset: reserve.asset,
        balance: formatted,
        valueUsd: parseFloat(formatted) * price,
        apy: 0,
        color: "#8B5CF6",
      });
    }
  }

  // Fetch APY from DefiLlama for each asset (best-effort, 0 on failure).
  for (const pos of positions) {
    if (pos.type === "supply") {
      const apy = await getProtocolApy("neverland", pos.asset).catch(() => 0);
      pos.apy = apy;
    }
  }

  return positions;
}

// ─── Curvance (ERC-4626 lending) ───
// cTokens are ERC-4626: balanceOf gives shares, convertToAssets gives underlying.

async function fetchCurvancePositions(
  walletAddress: `0x${string}`,
  prices: Map<string, number>
): Promise<LendingPosition[]> {
  if (CURVANCE_MARKETS.length === 0) return [];
  const normalizedWallet = getAddress(walletAddress);

  // Batch 1: balanceOf on every cToken.
  const balanceCalls = CURVANCE_MARKETS.map((m) => ({
    address: getAddress(m.cToken),
    abi: ERC20_ABI,
    functionName: "balanceOf" as const,
    args: [normalizedWallet] as const,
  }));
  const balResults = await monadClient.multicall({ contracts: balanceCalls });

  const held: { market: typeof CURVANCE_MARKETS[number]; shares: bigint }[] = [];
  balResults.forEach((r, i) => {
    if (r.status === "success" && (r.result as bigint) > 0n) {
      held.push({ market: CURVANCE_MARKETS[i], shares: r.result as bigint });
    }
  });
  if (held.length === 0) return [];

  // Batch 2: convertToAssets for non-zero balances.
  const assetsCalls = held.map(({ market, shares }) => ({
    address: getAddress(market.cToken),
    abi: ERC4626_ABI,
    functionName: "convertToAssets" as const,
    args: [shares] as const,
  }));
  const assetsResults = await monadClient.multicall({ contracts: assetsCalls });

  const positions: LendingPosition[] = [];
  for (let i = 0; i < held.length; i++) {
    const { market, shares } = held[i];
    const assets = assetsResults[i].status === "success"
      ? (assetsResults[i].result as bigint)
      : shares;
    const formatted = formatUnits(assets, market.decimals);
    const price = prices.get(market.underlyingSymbol) || 0;
    const apy = await getProtocolApy("curvance", market.underlyingSymbol).catch(() => 0);

    positions.push({
      protocol: `Curvance · ${market.cTokenSymbol}`,
      type: "supply",
      asset: market.underlyingSymbol,
      balance: formatted,
      valueUsd: parseFloat(formatted) * price,
      apy,
      color: "#F97316",
    });
  }

  return positions;
}

// ─── Euler V2 Earn + Gearbox Edge vaults (ERC-4626) ───
// Both use standard ERC-4626: balanceOf → convertToAssets for underlying value.
async function fetchErc4626VaultPositions(
  walletAddress: `0x${string}`,
  prices: Map<string, number>,
  vaults: { name: string; address: `0x${string}`; underlyingSymbol: string; color: string }[],
  protocolPrefix: string
): Promise<LendingPosition[]> {
  if (vaults.length === 0) return [];
  const normalizedWallet = getAddress(walletAddress);

  const balanceCalls = vaults.map((v) => ({
    address: getAddress(v.address),
    abi: ERC4626_ABI,
    functionName: "balanceOf" as const,
    args: [normalizedWallet] as const,
  }));

  let balResults;
  try {
    balResults = await monadClient.multicall({ contracts: balanceCalls });
  } catch {
    return [];
  }

  const held: { vault: typeof vaults[number]; shares: bigint }[] = [];
  balResults.forEach((r, i) => {
    if (r.status === "success" && (r.result as bigint) > 0n) {
      held.push({ vault: vaults[i], shares: r.result as bigint });
    }
  });
  if (held.length === 0) return [];

  const assetsCalls = held.map(({ vault, shares }) => ({
    address: getAddress(vault.address),
    abi: ERC4626_ABI,
    functionName: "convertToAssets" as const,
    args: [shares] as const,
  }));

  let assetsResults;
  try {
    assetsResults = await monadClient.multicall({ contracts: assetsCalls });
  } catch {
    return [];
  }

  const positions: LendingPosition[] = [];
  held.forEach(({ vault, shares }, i) => {
    const r = assetsResults[i];
    const assetAmount = r.status === "success" ? (r.result as bigint) : shares;
    const tokenInfo = Object.values(TOKENS).find((t) => t.symbol === vault.underlyingSymbol);
    const decimals = tokenInfo?.decimals ?? 18;
    const formatted = formatUnits(assetAmount, decimals);
    const price = prices.get(vault.underlyingSymbol) || 0;

    positions.push({
      protocol: `${protocolPrefix} · ${vault.name}`,
      type: "supply",
      asset: vault.underlyingSymbol,
      balance: formatted,
      valueUsd: parseFloat(formatted) * price,
      apy: 0, // APY from Merkl yield aggregator
      color: vault.color,
    });
  });

  return positions;
}

// ─── Fetch all lending positions ───
export async function fetchLendingPositions(
  walletAddress: `0x${string}`
): Promise<LendingPosition[]> {
  const [prices, dynamicVaults] = await Promise.all([
    fetchTokenPrices(),
    fetchTopMorphoVaults(20),
  ]);

  const vaultsToCheck = dynamicVaults ?? staticMorphoVaultsAsFallback();
  if (dynamicVaults === null) {
    console.warn(
      `Using static MORPHO_VAULTS fallback (${vaultsToCheck.length} vaults)`
    );
  }

  // Run all protocol fetchers in parallel.
  const [morpho, neverland, curvance, euler, eulerV2, gearbox] = await Promise.all([
    fetchMorphoVaultPositions(walletAddress, prices, vaultsToCheck),
    fetchNeverlandPositions(walletAddress, prices),
    fetchCurvancePositions(walletAddress, prices),
    Promise.all(
      LENDING_PROTOCOLS.filter((p) => p.type === "euler").map((p) =>
        fetchEulerPositions(p, walletAddress, prices, 0)
      )
    ).then((arr) => arr.flat()),
    fetchErc4626VaultPositions(walletAddress, prices, EULER_VAULTS, "Euler V2"),
    fetchErc4626VaultPositions(walletAddress, prices, GEARBOX_VAULTS, "Gearbox"),
  ]);

  return [...morpho, ...neverland, ...curvance, ...euler, ...eulerV2, ...gearbox];
}
