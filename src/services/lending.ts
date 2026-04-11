import { formatUnits, getAddress } from "viem";
import { monadClient } from "@/lib/client";
import { ERC4626_ABI, EULER_VAULT_ABI } from "@/lib/abis";
import { LENDING_PROTOCOLS, type LendingProtocol } from "@/config/protocols";
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

// ─── Fetch all lending positions ───
export async function fetchLendingPositions(
  walletAddress: `0x${string}`
): Promise<LendingPosition[]> {
  const [prices, morphoApy, eulerApy] = await Promise.all([
    fetchTokenPrices(),
    getProtocolApy("morpho").catch(() => 0),
    getProtocolApy("euler").catch(() => 0),
  ]);

  const allPositions: LendingPosition[] = [];

  for (const protocol of LENDING_PROTOCOLS) {
    const apy = protocol.type === "morpho" ? morphoApy : eulerApy;

    if (protocol.type === "euler") {
      const positions = await fetchEulerPositions(
        protocol,
        walletAddress,
        prices,
        apy
      );
      allPositions.push(...positions);
    }
    // Morpho Blue requires market IDs for position queries.
    // Skip for now — would need a curated list of market IDs or event scanning.
  }

  return allPositions;
}
