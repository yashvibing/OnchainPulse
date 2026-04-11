import { getAddress } from "viem";
import { monadClient } from "@/lib/client";
import { UNI_V3_NFT_ABI } from "@/lib/abis";
import { UNISWAP_V3_POSITION_MANAGER } from "@/config/protocols";
import { getTokenByAddress } from "@/config/tokens";
import { fetchTokenPrices } from "./tokens";

// ─── Types ───

export interface LiquidityPosition {
  tokenId: number;
  token0Symbol: string;
  token1Symbol: string;
  fee: number;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  tokensOwed0: string;
  tokensOwed1: string;
  valueUsd: number;
  color: string;
}

// Fee tier to basis points display
function formatFee(fee: number): string {
  if (fee === 100) return "0.01%";
  if (fee === 500) return "0.05%";
  if (fee === 3000) return "0.3%";
  if (fee === 10000) return "1%";
  return `${fee / 10000}%`;
}

// ─── Fetch all UniV3 LP positions ───
export async function fetchLiquidityPositions(
  walletAddress: `0x${string}`
): Promise<LiquidityPosition[]> {
  const positionManager = getAddress(UNISWAP_V3_POSITION_MANAGER);
  const normalizedWallet = getAddress(walletAddress);

  try {
    // Get NFT count
    console.log("[LP] Starting fetch for", normalizedWallet);
    const nftCount = await monadClient.readContract({
      address: positionManager,
      abi: UNI_V3_NFT_ABI,
      functionName: "balanceOf",
      args: [normalizedWallet],
    });

    console.log("[LP] balanceOf result:", nftCount);
    if (nftCount === 0n) return [];

    const count = Number(nftCount);
    const limit = Math.min(count, 20);

    // Fetch token IDs in parallel (viem auto-batches via implicit multicall)
    const tokenIds = await Promise.all(
      Array.from({ length: limit }, (_, i) =>
        monadClient
          .readContract({
            address: positionManager,
            abi: UNI_V3_NFT_ABI,
            functionName: "tokenOfOwnerByIndex",
            args: [normalizedWallet, BigInt(i)],
          })
          .catch(() => null)
      )
    );

    const validTokenIds = tokenIds.filter((id): id is bigint => id !== null);
    console.log("[LP] tokenIds:", validTokenIds.length, "of", limit);
    if (validTokenIds.length === 0) return [];

    // Fetch position details + prices in parallel
    const [prices, ...positionResults] = await Promise.all([
      fetchTokenPrices(),
      ...validTokenIds.map((tokenId) =>
        monadClient
          .readContract({
            address: positionManager,
            abi: UNI_V3_NFT_ABI,
            functionName: "positions",
            args: [tokenId],
          })
          .catch(() => null)
      ),
    ]);

    const positions: LiquidityPosition[] = [];

    for (let i = 0; i < positionResults.length; i++) {
      const result = positionResults[i];
      if (!result) continue;

      const [
        ,
        ,
        token0Addr,
        token1Addr,
        fee,
        tickLower,
        tickUpper,
        liquidity,
        ,
        ,
        tokensOwed0,
        tokensOwed1,
      ] = result;

      // Skip closed positions (zero liquidity and no owed tokens)
      if (liquidity === 0n && tokensOwed0 === 0n && tokensOwed1 === 0n)
        continue;

      const token0 = getTokenByAddress(token0Addr);
      const token1 = getTokenByAddress(token1Addr);

      const token0Symbol = token0?.symbol || token0Addr.slice(0, 8) + "...";
      const token1Symbol = token1?.symbol || token1Addr.slice(0, 8) + "...";

      // Estimate value from owed tokens (conservative — doesn't include in-range liquidity)
      const price0 = (prices as Map<string, number>).get(token0Symbol) || 0;
      const price1 = (prices as Map<string, number>).get(token1Symbol) || 0;
      const decimals0 = token0?.decimals || 18;
      const decimals1 = token1?.decimals || 18;

      const owed0Formatted = Number(tokensOwed0) / 10 ** decimals0;
      const owed1Formatted = Number(tokensOwed1) / 10 ** decimals1;
      const owedValue = owed0Formatted * price0 + owed1Formatted * price1;

      // Rough liquidity value estimate (simplified — proper calc needs sqrtPriceX96)
      const liquidityNum = Number(liquidity);
      const liquidityValue =
        liquidityNum > 0
          ? (liquidityNum / 1e18) * ((price0 + price1) / 2) * 2
          : 0;

      positions.push({
        tokenId: Number(validTokenIds[i]),
        token0Symbol,
        token1Symbol,
        fee,
        liquidity: liquidity.toString(),
        tickLower,
        tickUpper,
        tokensOwed0: owed0Formatted.toFixed(6),
        tokensOwed1: owed1Formatted.toFixed(6),
        valueUsd: owedValue + liquidityValue,
        color: "#8B5CF6",
      });
    }

    console.log("[LP] Returning", positions.length, "positions");
    return positions;
  } catch (err) {
    console.error("[LP] CATCH:", err);
    return [];
  }
}

export { formatFee };
