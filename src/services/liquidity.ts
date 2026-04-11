import { getAddress } from "viem";
import { monadClient } from "@/lib/client";
import {
  UNI_V3_NFT_ABI,
  UNI_V3_FACTORY_ABI,
  UNI_V3_POOL_ABI,
} from "@/lib/abis";
import {
  UNISWAP_V3_POSITION_MANAGER,
  UNISWAP_V3_FACTORY,
} from "@/config/protocols";
import { getTokenByAddress } from "@/config/tokens";
import { fetchTokenPrices } from "./tokens";

// ─── Types ───

export interface LiquidityPosition {
  tokenId: number;
  protocol: string;
  token0Symbol: string;
  token1Symbol: string;
  fee: number;
  feeLabel: string;
  amount0: string; // formatted token amount
  amount1: string;
  inRange: boolean;
  valueUsd: number;
  feesUsd: number; // unclaimed fees in USD
  color: string;
}

// ─── Fee tier display ───
export function formatFee(fee: number): string {
  if (fee === 100) return "0.01%";
  if (fee === 500) return "0.05%";
  if (fee === 3000) return "0.3%";
  if (fee === 10000) return "1%";
  return `${fee / 10000}%`;
}

// ─── Uniswap V3 amount math ───
//
// Given a position's liquidity L, its tick range [tickLower, tickUpper], and
// the pool's current tick, compute how much of token0 and token1 the position
// is entitled to. Standard V3 math (see Uniswap whitepaper, eq. 6.29-6.30).
//
// We do the sqrt-ratio calculation in floating point because Number gives us
// ~15 digits of precision and we're displaying USD values rounded to cents.
// For very large positions (L > 2^53) we lose a few low-order digits but the
// dollar figure stays accurate. The "right" approach is bigint TickMath; we
// can upgrade later if precision becomes a problem.
function computeAmountsFromLiquidity(
  liquidity: bigint,
  tickLower: number,
  tickUpper: number,
  currentTick: number
): { rawAmount0: number; rawAmount1: number } {
  // sqrt(1.0001^tick) = 1.0001^(tick/2)
  const sqrtLower = Math.pow(1.0001, tickLower / 2);
  const sqrtUpper = Math.pow(1.0001, tickUpper / 2);
  const sqrtCurrent = Math.pow(1.0001, currentTick / 2);

  const L = Number(liquidity);

  let amount0 = 0;
  let amount1 = 0;

  if (currentTick < tickLower) {
    // Below the range: position is entirely token0
    amount0 = (L * (sqrtUpper - sqrtLower)) / (sqrtLower * sqrtUpper);
  } else if (currentTick >= tickUpper) {
    // Above the range: position is entirely token1
    amount1 = L * (sqrtUpper - sqrtLower);
  } else {
    // In range: split between both
    amount0 = (L * (sqrtUpper - sqrtCurrent)) / (sqrtCurrent * sqrtUpper);
    amount1 = L * (sqrtCurrent - sqrtLower);
  }

  return { rawAmount0: amount0, rawAmount1: amount1 };
}

// ─── Fetch all UniV3 LP positions ───
export async function fetchLiquidityPositions(
  walletAddress: `0x${string}`
): Promise<LiquidityPosition[]> {
  const positionManager = getAddress(UNISWAP_V3_POSITION_MANAGER);
  const factory = getAddress(UNISWAP_V3_FACTORY);
  const normalizedWallet = getAddress(walletAddress);

  try {
    const nftCount = await monadClient.readContract({
      address: positionManager,
      abi: UNI_V3_NFT_ABI,
      functionName: "balanceOf",
      args: [normalizedWallet],
    });

    if (nftCount === 0n) return [];

    const count = Math.min(Number(nftCount), 50); // sane upper bound

    // Round 1: get all token IDs
    const tokenIdCalls = Array.from({ length: count }, (_, i) => ({
      address: positionManager,
      abi: UNI_V3_NFT_ABI,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [normalizedWallet, BigInt(i)] as const,
    }));
    const tokenIdResults = await monadClient.multicall({
      contracts: tokenIdCalls,
    });
    const tokenIds = tokenIdResults
      .map((r) => (r.status === "success" ? (r.result as bigint) : null))
      .filter((id): id is bigint => id !== null);

    if (tokenIds.length === 0) return [];

    // Round 2: positions(tokenId) for each. We also fetch prices in parallel.
    const positionCalls = tokenIds.map((tokenId) => ({
      address: positionManager,
      abi: UNI_V3_NFT_ABI,
      functionName: "positions" as const,
      args: [tokenId] as const,
    }));
    const [prices, positionResults] = await Promise.all([
      fetchTokenPrices(),
      monadClient.multicall({ contracts: positionCalls }),
    ]);

    // Build a list of "live" positions (non-zero liquidity OR unclaimed fees)
    // and collect the unique pools we'll need slot0 for.
    type RawPos = {
      tokenId: bigint;
      token0: `0x${string}`;
      token1: `0x${string}`;
      fee: number;
      tickLower: number;
      tickUpper: number;
      liquidity: bigint;
      tokensOwed0: bigint;
      tokensOwed1: bigint;
    };
    const live: RawPos[] = [];
    positionResults.forEach((r, i) => {
      if (r.status !== "success") return;
      const pos = r.result as readonly [
        bigint, // nonce
        `0x${string}`, // operator
        `0x${string}`, // token0
        `0x${string}`, // token1
        number, // fee
        number, // tickLower
        number, // tickUpper
        bigint, // liquidity
        bigint, // feeGrowthInside0LastX128
        bigint, // feeGrowthInside1LastX128
        bigint, // tokensOwed0
        bigint, // tokensOwed1
      ];
      const liquidity = pos[7];
      const tokensOwed0 = pos[10];
      const tokensOwed1 = pos[11];
      if (liquidity === 0n && tokensOwed0 === 0n && tokensOwed1 === 0n) return;
      live.push({
        tokenId: tokenIds[i],
        token0: pos[2],
        token1: pos[3],
        fee: pos[4],
        tickLower: pos[5],
        tickUpper: pos[6],
        liquidity,
        tokensOwed0,
        tokensOwed1,
      });
    });

    if (live.length === 0) return [];

    // Round 3: factory.getPool(token0, token1, fee) for each live position.
    const poolAddrCalls = live.map((p) => ({
      address: factory,
      abi: UNI_V3_FACTORY_ABI,
      functionName: "getPool" as const,
      args: [p.token0, p.token1, p.fee] as const,
    }));
    const poolAddrResults = await monadClient.multicall({
      contracts: poolAddrCalls,
    });
    const poolAddrs: (`0x${string}` | null)[] = poolAddrResults.map((r) =>
      r.status === "success" ? (r.result as `0x${string}`) : null
    );

    // Round 4: slot0() for each pool — gives us currentTick + sqrtPriceX96.
    // De-duplicate by pool address since multiple positions can share a pool.
    const uniquePools = Array.from(
      new Set(poolAddrs.filter((a): a is `0x${string}` => a !== null))
    );
    const slot0Calls = uniquePools.map((addr) => ({
      address: addr,
      abi: UNI_V3_POOL_ABI,
      functionName: "slot0" as const,
      args: [] as const,
    }));
    const slot0Results =
      slot0Calls.length > 0
        ? await monadClient.multicall({ contracts: slot0Calls })
        : [];
    const poolTickByAddr = new Map<string, number>();
    slot0Results.forEach((r, i) => {
      if (r.status === "success") {
        const tick = (r.result as readonly [bigint, number, ...unknown[]])[1];
        poolTickByAddr.set(uniquePools[i].toLowerCase(), tick);
      }
    });

    // Now build the final positions with proper amount math + USD value.
    const positions: LiquidityPosition[] = [];
    live.forEach((p, i) => {
      const poolAddr = poolAddrs[i];
      const currentTick = poolAddr
        ? poolTickByAddr.get(poolAddr.toLowerCase())
        : undefined;
      // If we couldn't get the pool's current tick, fall back to "in range"
      // assumption with currentTick at the midpoint. The value will be
      // approximate but better than nothing.
      const usableTick =
        currentTick !== undefined
          ? currentTick
          : Math.floor((p.tickLower + p.tickUpper) / 2);

      const { rawAmount0, rawAmount1 } = computeAmountsFromLiquidity(
        p.liquidity,
        p.tickLower,
        p.tickUpper,
        usableTick
      );

      const token0 = getTokenByAddress(p.token0);
      const token1 = getTokenByAddress(p.token1);
      const sym0 =
        token0?.symbol ?? `${p.token0.slice(0, 6)}…${p.token0.slice(-4)}`;
      const sym1 =
        token1?.symbol ?? `${p.token1.slice(0, 6)}…${p.token1.slice(-4)}`;
      const dec0 = token0?.decimals ?? 18;
      const dec1 = token1?.decimals ?? 18;

      const formattedAmt0 = rawAmount0 / 10 ** dec0;
      const formattedAmt1 = rawAmount1 / 10 ** dec1;
      const owed0 = Number(p.tokensOwed0) / 10 ** dec0;
      const owed1 = Number(p.tokensOwed1) / 10 ** dec1;

      const price0 = prices.get(sym0) || 0;
      const price1 = prices.get(sym1) || 0;
      const valueUsd =
        formattedAmt0 * price0 +
        formattedAmt1 * price1 +
        owed0 * price0 +
        owed1 * price1;
      const feesUsd = owed0 * price0 + owed1 * price1;

      const inRange =
        currentTick !== undefined &&
        currentTick >= p.tickLower &&
        currentTick < p.tickUpper;

      positions.push({
        tokenId: Number(p.tokenId),
        protocol: "Uniswap V3",
        token0Symbol: sym0,
        token1Symbol: sym1,
        fee: p.fee,
        feeLabel: formatFee(p.fee),
        amount0: formattedAmt0.toFixed(formattedAmt0 < 1 ? 6 : 4),
        amount1: formattedAmt1.toFixed(formattedAmt1 < 1 ? 6 : 4),
        inRange,
        valueUsd,
        feesUsd,
        color: "#FF007A",
      });
    });

    // Sort by USD value descending
    positions.sort((a, b) => b.valueUsd - a.valueUsd);

    return positions;
  } catch (err) {
    console.error("[liquidity] fetch failed:", err);
    return [];
  }
}
