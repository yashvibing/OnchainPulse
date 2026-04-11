"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTokenBalances, type TokenBalance } from "@/services/tokens";
import {
  fetchStakingPositions,
  type StakingPosition,
} from "@/services/staking";
import {
  fetchVaultPositions,
  type VaultPosition,
} from "@/services/vaults";
import {
  fetchLendingPositions,
  type LendingPosition,
} from "@/services/lending";
import {
  fetchLiquidityPositions,
  type LiquidityPosition,
} from "@/services/liquidity";
import { fetchMonadYields, type YieldPool } from "@/services/yields";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

// ─── Token Balances Hook ───
export function useTokenBalances(address: string | null) {
  return useQuery<TokenBalance[]>({
    queryKey: ["tokenBalances", address],
    queryFn: () => fetchTokenBalances(address as `0x${string}`),
    enabled: !!address && ADDRESS_RE.test(address),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

// ─── Staking Positions Hook ───
export function useStakingPositions(address: string | null) {
  return useQuery<StakingPosition[]>({
    queryKey: ["stakingPositions", address],
    queryFn: () => fetchStakingPositions(address as `0x${string}`),
    enabled: !!address && ADDRESS_RE.test(address),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
}

// ─── Vault Positions Hook ───
export function useVaultPositions(address: string | null) {
  return useQuery<VaultPosition[]>({
    queryKey: ["vaultPositions", address],
    queryFn: () => fetchVaultPositions(address as `0x${string}`),
    enabled: !!address && ADDRESS_RE.test(address),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
}

// ─── Lending Positions Hook ───
export function useLendingPositions(address: string | null) {
  return useQuery<LendingPosition[]>({
    queryKey: ["lendingPositions", address],
    queryFn: () => fetchLendingPositions(address as `0x${string}`),
    enabled: !!address && ADDRESS_RE.test(address),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
}

// ─── Liquidity Positions Hook ───
export function useLiquidityPositions(address: string | null) {
  return useQuery<LiquidityPosition[]>({
    queryKey: ["liquidityPositions", address],
    queryFn: () => fetchLiquidityPositions(address as `0x${string}`),
    enabled: !!address && ADDRESS_RE.test(address),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
}

// ─── Monad Yield Pools Hook ───
export function useMonadYields() {
  return useQuery<YieldPool[]>({
    queryKey: ["monadYields"],
    queryFn: fetchMonadYields,
    staleTime: 300_000,
  });
}

// ─── Combined Portfolio Hook ───
export function usePortfolio(address: string | null) {
  const tokens = useTokenBalances(address);
  const staking = useStakingPositions(address);
  const vaults = useVaultPositions(address);
  const lending = useLendingPositions(address);
  const liquidity = useLiquidityPositions(address);

  const isLoading =
    tokens.isLoading ||
    staking.isLoading ||
    vaults.isLoading ||
    lending.isLoading ||
    liquidity.isLoading;

  const isError = tokens.isError && staking.isError;

  // Exclude LSTs from token total — their value is already counted via the
  // matching staking position (e.g. shMON token balance == FastLane staking
  // position). Without this filter, totalValue is roughly 2× the real value.
  const totalTokenValue =
    tokens.data
      ?.filter((t) => t.token.category !== "lst")
      .reduce((sum, t) => sum + t.valueUsd, 0) || 0;
  const totalStakingValue =
    staking.data?.reduce((sum, s) => sum + s.stakedValueUsd, 0) || 0;
  const totalVaultValue =
    vaults.data?.reduce((sum, v) => sum + v.valueUsd, 0) || 0;
  const totalLendingSupply =
    lending.data
      ?.filter((l) => l.type === "supply")
      .reduce((sum, l) => sum + l.valueUsd, 0) || 0;
  const totalLendingBorrow =
    lending.data
      ?.filter((l) => l.type === "borrow")
      .reduce((sum, l) => sum + l.valueUsd, 0) || 0;
  const totalLiquidityValue =
    liquidity.data?.reduce((sum, l) => sum + l.valueUsd, 0) || 0;

  const totalValue =
    totalTokenValue +
    totalStakingValue +
    totalVaultValue +
    totalLendingSupply -
    totalLendingBorrow +
    totalLiquidityValue;

  const stakingYield =
    staking.data?.reduce(
      (sum, s) => sum + (s.stakedValueUsd * s.apy) / 36500,
      0
    ) || 0;
  const vaultYield =
    vaults.data?.reduce(
      (sum, v) => sum + (v.valueUsd * v.apy) / 36500,
      0
    ) || 0;
  const lendingYield =
    lending.data
      ?.filter((l) => l.type === "supply")
      .reduce((sum, l) => sum + (l.valueUsd * l.apy) / 36500, 0) || 0;
  const dailyYield = stakingYield + vaultYield + lendingYield;

  const allPositionCount =
    (staking.data?.length || 0) +
    (vaults.data?.length || 0) +
    (lending.data?.length || 0) +
    (liquidity.data?.length || 0);

  const allProtocols = new Set([
    ...(staking.data?.map((s) => s.protocol) || []),
    ...(vaults.data?.map((v) => v.vaultName) || []),
    ...(lending.data?.map((l) => l.protocol) || []),
    ...(liquidity.data?.length ? ["Uniswap V3"] : []),
  ]);

  return {
    tokens: tokens.data || [],
    staking: staking.data || [],
    vaults: vaults.data || [],
    lending: lending.data || [],
    liquidity: liquidity.data || [],
    totalValue,
    totalTokenValue,
    totalStakingValue,
    dailyYield,
    positionCount: allPositionCount,
    protocolCount: allProtocols.size,
    isLoading,
    isError,
    refetch: () => {
      tokens.refetch();
      staking.refetch();
      vaults.refetch();
      lending.refetch();
      liquidity.refetch();
    },
  };
}
