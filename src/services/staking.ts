import { formatUnits, getAddress } from "viem";
import { monadClient } from "@/lib/client";
import { ERC20_ABI, ERC4626_ABI } from "@/lib/abis";
import { STAKING_PROTOCOLS, type StakingProtocol } from "@/config/protocols";
import { fetchTokenPrices } from "./tokens";

// ─── Types ───

export interface StakingPosition {
  protocol: string;
  lstSymbol: string;
  lstBalance: string;
  monEquivalent: string;
  exchangeRate: number;
  stakedValueUsd: number;
  apy: number;
  color: string;
}

// ─── Fetch APYs from DefiLlama ───
async function fetchStakingApys(): Promise<Map<string, number>> {
  const apys = new Map<string, number>();

  try {
    const res = await fetch("https://yields.llama.fi/pools", {
      next: { revalidate: 300 }, // cache 5 min
    });
    const { data } = await res.json();

    const monadPools = data.filter(
      (pool: { chain: string }) => pool.chain === "Monad"
    );

    for (const pool of monadPools) {
      const name = (pool.project || "").toLowerCase();
      for (const protocol of STAKING_PROTOCOLS) {
        if (name.includes(protocol.name.toLowerCase())) {
          apys.set(protocol.name, pool.apy || 0);
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch staking APYs:", err);
  }

  // Fallback APYs if API fails
  if (!apys.has("aPriori")) apys.set("aPriori", 17.2);
  if (!apys.has("FastLane")) apys.set("FastLane", 15.8);

  return apys;
}

// ─── Fetch single staking position ───
async function fetchStakingPosition(
  protocol: StakingProtocol,
  walletAddress: `0x${string}`,
  monPrice: number,
  apy: number
): Promise<StakingPosition | null> {
  try {
    // Get LST token balance
    const normalizedLst = getAddress(protocol.lstToken);
    const normalizedWallet = getAddress(walletAddress);
    const lstBalance = await monadClient.readContract({
      address: normalizedLst,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [normalizedWallet],
    });

    if (lstBalance === 0n) return null;

    // Get exchange rate: how much MON per 1 LST
    let monEquivalent: bigint;
    try {
      monEquivalent = await monadClient.readContract({
        address: normalizedLst,
        abi: ERC4626_ABI,
        functionName: "convertToAssets",
        args: [lstBalance],
      });
    } catch {
      // If convertToAssets fails, assume 1:1 rate
      monEquivalent = lstBalance;
    }

    const lstFormatted = formatUnits(lstBalance, 18);
    const monFormatted = formatUnits(monEquivalent, 18);

    return {
      protocol: protocol.name,
      lstSymbol: protocol.lstSymbol,
      lstBalance: lstFormatted,
      monEquivalent: monFormatted,
      exchangeRate:
        Number(monEquivalent) / Number(lstBalance || 1n),
      stakedValueUsd: parseFloat(monFormatted) * monPrice,
      apy,
      color: protocol.color,
    };
  } catch (err) {
    console.error(`Failed to fetch ${protocol.name} position:`, err);
    return null;
  }
}

// ─── Fetch all staking positions ───
export async function fetchStakingPositions(
  walletAddress: `0x${string}`
): Promise<StakingPosition[]> {
  const [prices, apys] = await Promise.all([
    fetchTokenPrices(),
    fetchStakingApys(),
  ]);

  const monPrice = prices.get("MON") || 0;

  const positions = await Promise.all(
    STAKING_PROTOCOLS.map((protocol) =>
      fetchStakingPosition(
        protocol,
        walletAddress,
        monPrice,
        apys.get(protocol.name) || 0
      )
    )
  );

  return positions.filter((p): p is StakingPosition => p !== null);
}
