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
// We batch one balanceOf call per vault via multicall, then for any non-zero
// balance we batch convertToAssets calls. APYs come from Morpho's GraphQL API.

interface MorphoVaultApyMap {
  // address (lowercase) → netApy as a fraction (0.0626 = 6.26%)
  [address: string]: number;
}

async function fetchMorphoVaultApys(): Promise<MorphoVaultApyMap> {
  try {
    const addresses = MORPHO_VAULTS.map((v) => `"${v.address}"`).join(",");
    const query = `{
      vaults(where: {chainId_in: [143], address_in: [${addresses}]}, first: 50) {
        items { address state { netApy } }
      }
    }`;
    const res = await fetch("https://blue-api.morpho.org/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
      next: { revalidate: 300 }, // cache 5 min
    });
    const data = await res.json();
    const out: MorphoVaultApyMap = {};
    for (const item of data?.data?.vaults?.items || []) {
      const apy = item?.state?.netApy;
      if (typeof apy === "number") {
        out[item.address.toLowerCase()] = apy;
      }
    }
    return out;
  } catch (err) {
    console.error("Failed to fetch Morpho vault APYs:", err);
    return {};
  }
}

async function fetchMorphoVaultPositions(
  walletAddress: `0x${string}`,
  prices: Map<string, number>,
  apys: MorphoVaultApyMap
): Promise<LendingPosition[]> {
  if (MORPHO_VAULTS.length === 0) return [];
  const normalizedWallet = getAddress(walletAddress);

  // Batch 1: balanceOf for every vault.
  const balanceCalls = MORPHO_VAULTS.map((v) => ({
    address: getAddress(v.address),
    abi: ERC4626_ABI,
    functionName: "balanceOf" as const,
    args: [normalizedWallet] as const,
  }));
  const balanceResults = await monadClient.multicall({
    contracts: balanceCalls,
  });

  // Collect vaults with non-zero balances. Only these need a second round-trip.
  const heldVaults: { vault: MorphoVault; shares: bigint }[] = [];
  balanceResults.forEach((r, i) => {
    if (r.status === "success" && (r.result as bigint) > 0n) {
      heldVaults.push({ vault: MORPHO_VAULTS[i], shares: r.result as bigint });
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
    // netApy from Morpho is a fraction (0.0626). We display as %, so × 100.
    const apy = (apys[vault.address.toLowerCase()] || 0) * 100;

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

// ─── Fetch all lending positions ───
export async function fetchLendingPositions(
  walletAddress: `0x${string}`
): Promise<LendingPosition[]> {
  const [prices, morphoApys, eulerApy] = await Promise.all([
    fetchTokenPrices(),
    fetchMorphoVaultApys(),
    getProtocolApy("euler").catch(() => 0),
  ]);

  const allPositions: LendingPosition[] = [];

  // Morpho MetaMorpho vaults — most users have positions here, not in
  // raw Morpho Blue markets.
  const morphoPositions = await fetchMorphoVaultPositions(
    walletAddress,
    prices,
    morphoApys
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
