import { formatUnits, getAddress } from "viem";
import { monadClient } from "@/lib/client";
import { ERC4626_ABI } from "@/lib/abis";
import { YIELD_VAULTS, type YieldVault } from "@/config/protocols";
import { TOKENS } from "@/config/tokens";
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

    // For standard ERC-4626 vaults, convertToAssets gives us the live
    // share→asset rate. For custom vaults (e.g. Upshift earnAUSD) that
    // don't expose it, fall back to a 1:1 assumption with the underlying.
    // The 1:1 fallback under-reports yield that has accrued — typically
    // a few percent — but at least the position appears with a roughly
    // correct USD value.
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

    // Look up real decimals — vaults don't all use 18. earnAUSD has 6.
    // Both share and asset usually share the same decimals; we use the
    // underlying token's decimals as the source of truth.
    const underlyingTokenInfo = Object.values(TOKENS).find(
      (t) => t.symbol === vault.underlyingSymbol
    );
    const decimals = underlyingTokenInfo?.decimals ?? 18;

    const sharesFormatted = formatUnits(sharesBalance, decimals);
    const underlyingFormatted = formatUnits(underlyingBalance, decimals);
    const price = prices.get(vault.underlyingSymbol) || 0;

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

// Each YieldVault gets its own DefiLlama lookup so vaults with multiple
// pools (Upshift has earnAUSD AND earnMON) resolve to the right APY by
// matching against the symbol embedded in the vault name.
function deriveDefiLlamaSymbolFilter(vaultName: string): string | undefined {
  // "Upshift earnAUSD" → "earnausd" so we hit the EARNAUSD pool, not EARNMON.
  const m = vaultName.toLowerCase().match(/earn[a-z]+/);
  return m ? m[0] : undefined;
}

// ─── Fetch all vault positions ───
export async function fetchVaultPositions(
  walletAddress: `0x${string}`
): Promise<VaultPosition[]> {
  const prices = await fetchTokenPrices();

  const positions = await Promise.all(
    YIELD_VAULTS.map(async (vault) => {
      // Resolve APY in parallel with the on-chain reads (one DefiLlama
      // call per vault, all cached behind the 5-min pool list).
      const symbolFilter = deriveDefiLlamaSymbolFilter(vault.name);
      const apy = await getProtocolApy("upshift", symbolFilter).catch(() => 0);
      return fetchVaultPosition(vault, walletAddress, prices, apy);
    })
  );

  return positions.filter((p): p is VaultPosition => p !== null);
}
