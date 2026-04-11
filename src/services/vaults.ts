import { formatUnits, getAddress } from "viem";
import { monadClient } from "@/lib/client";
import { ERC4626_ABI } from "@/lib/abis";
import { YIELD_VAULTS, type YieldVault } from "@/config/protocols";
import { fetchTokenPrices } from "./tokens";
import { getProtocolApy } from "./yields";

// ─── Types ───

export interface VaultPosition {
  vaultName: string;
  underlyingSymbol: string;
  sharesBalance: string;
  underlyingBalance: string;
  valueUsd: number;
  apy: number;
  color: string;
}

// ─── Fetch single vault position ───
async function fetchVaultPosition(
  vault: YieldVault,
  walletAddress: `0x${string}`,
  prices: Map<string, number>,
  apy: number
): Promise<VaultPosition | null> {
  try {
    const normalizedVault = getAddress(vault.vaultAddress);
    const normalizedWallet = getAddress(walletAddress);

    const sharesBalance = await monadClient.readContract({
      address: normalizedVault,
      abi: ERC4626_ABI,
      functionName: "balanceOf",
      args: [normalizedWallet],
    });

    if (sharesBalance === 0n) return null;

    let underlyingBalance: bigint;
    try {
      underlyingBalance = await monadClient.readContract({
        address: normalizedVault,
        abi: ERC4626_ABI,
        functionName: "convertToAssets",
        args: [sharesBalance],
      });
    } catch {
      underlyingBalance = sharesBalance;
    }

    const sharesFormatted = formatUnits(sharesBalance, 18);
    const underlyingFormatted = formatUnits(underlyingBalance, 18);
    const price = prices.get(vault.underlyingSymbol) || prices.get("MON") || 0;

    return {
      vaultName: vault.name,
      underlyingSymbol: vault.underlyingSymbol,
      sharesBalance: sharesFormatted,
      underlyingBalance: underlyingFormatted,
      valueUsd: parseFloat(underlyingFormatted) * price,
      apy,
      color: vault.color,
    };
  } catch (err) {
    console.error(`Failed to fetch ${vault.name} position:`, err);
    return null;
  }
}

// ─── Fetch all vault positions ───
export async function fetchVaultPositions(
  walletAddress: `0x${string}`
): Promise<VaultPosition[]> {
  const [prices, apy] = await Promise.all([
    fetchTokenPrices(),
    getProtocolApy("upshift").catch(() => 0),
  ]);

  const positions = await Promise.all(
    YIELD_VAULTS.map((vault) =>
      fetchVaultPosition(vault, walletAddress, prices, apy)
    )
  );

  return positions.filter((p): p is VaultPosition => p !== null);
}
