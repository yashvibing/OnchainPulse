"use client";

import { useQuery } from "@tanstack/react-query";
import { type TokenBalance } from "@/services/tokens";
import { type StakingPosition } from "@/services/staking";
import { type VaultPosition } from "@/services/vaults";
import { type LendingPosition } from "@/services/lending";
import { type LiquidityPosition } from "@/services/liquidity";
import { fetchMonadYields, type YieldPool } from "@/services/yields";
import {
  deserializeTokenBalances,
  type PortfolioSnapshot,
  type SerializedTokenBalance,
} from "@/services/portfolio";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

interface ApiMeta {
  cacheStatus: "hit" | "miss" | "stale";
  cacheAgeMs: number;
  fetchedAt: number;
  durationMs: number;
}

interface PortfolioApiResponse extends Omit<PortfolioSnapshot, "tokens"> {
  tokens: SerializedTokenBalance[];
  meta?: ApiMeta;
}

interface PortfolioClientData extends Omit<PortfolioSnapshot, "tokens"> {
  tokens: TokenBalance[];
  meta?: ApiMeta;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return (await res.json()) as T;
}

async function fetchTokenBalancesFromApi(address: string): Promise<TokenBalance[]> {
  const payload = await fetchJson<{ data: SerializedTokenBalance[] }>(
    `/api/token-balances/${address}`
  );
  return deserializeTokenBalances(payload.data || []);
}

async function fetchPortfolioFromApi(address: string): Promise<PortfolioClientData> {
  const payload = await fetchJson<PortfolioApiResponse>(`/api/portfolio/${address}`);
  return {
    ...payload,
    tokens: deserializeTokenBalances(payload.tokens || []),
  };
}

export function useTokenBalances(address: string | null) {
  return useQuery<TokenBalance[]>({
    queryKey: ["tokenBalances", address],
    queryFn: () => fetchTokenBalancesFromApi(address as string),
    enabled: !!address && ADDRESS_RE.test(address),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useStakingPositions(address: string | null) {
  return useQuery<StakingPosition[]>({
    queryKey: ["stakingPositions", address],
    queryFn: async () => (await fetchPortfolioFromApi(address as string)).staking,
    enabled: !!address && ADDRESS_RE.test(address),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useVaultPositions(address: string | null) {
  return useQuery<VaultPosition[]>({
    queryKey: ["vaultPositions", address],
    queryFn: async () => (await fetchPortfolioFromApi(address as string)).vaults,
    enabled: !!address && ADDRESS_RE.test(address),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useLendingPositions(address: string | null) {
  return useQuery<LendingPosition[]>({
    queryKey: ["lendingPositions", address],
    queryFn: async () => (await fetchPortfolioFromApi(address as string)).lending,
    enabled: !!address && ADDRESS_RE.test(address),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useLiquidityPositions(address: string | null) {
  return useQuery<LiquidityPosition[]>({
    queryKey: ["liquidityPositions", address],
    queryFn: async () => (await fetchPortfolioFromApi(address as string)).liquidity,
    enabled: !!address && ADDRESS_RE.test(address),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useMonadYields() {
  return useQuery<YieldPool[]>({
    queryKey: ["monadYields"],
    queryFn: fetchMonadYields,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
}

export function usePortfolio(address: string | null) {
  const portfolio = useQuery<PortfolioClientData>({
    queryKey: ["portfolio", address],
    queryFn: () => fetchPortfolioFromApi(address as string),
    enabled: !!address && ADDRESS_RE.test(address),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const tokens = portfolio.data?.tokens || [];
  const staking = portfolio.data?.staking || [];
  const vaults = portfolio.data?.vaults || [];
  const lending = portfolio.data?.lending || [];
  const liquidity = portfolio.data?.liquidity || [];

  // Exclude LSTs from token total: their value is already counted via the
  // matching staking position. Without this filter, totalValue is roughly 2x.
  const totalTokenValue =
    tokens
      .filter((t) => t.token.category !== "lst")
      .reduce((sum, t) => sum + t.valueUsd, 0) || 0;
  const totalStakingValue =
    staking.reduce((sum, s) => sum + s.stakedValueUsd, 0) || 0;
  const totalVaultValue =
    vaults.reduce((sum, v) => sum + v.valueUsd, 0) || 0;
  const totalLendingSupply =
    lending
      .filter((l) => l.type === "supply")
      .reduce((sum, l) => sum + l.valueUsd, 0) || 0;
  const totalLendingBorrow =
    lending
      .filter((l) => l.type === "borrow")
      .reduce((sum, l) => sum + l.valueUsd, 0) || 0;
  const totalLiquidityValue =
    liquidity.reduce((sum, l) => sum + l.valueUsd, 0) || 0;

  const totalValue =
    totalTokenValue +
    totalStakingValue +
    totalVaultValue +
    totalLendingSupply -
    totalLendingBorrow +
    totalLiquidityValue;

  const stakingYield =
    staking.reduce(
      (sum, s) => sum + (s.stakedValueUsd * s.apy) / 36500,
      0
    ) || 0;
  const vaultYield =
    vaults.reduce(
      (sum, v) => sum + (v.valueUsd * v.apy) / 36500,
      0
    ) || 0;
  const lendingYield =
    lending
      .filter((l) => l.type === "supply")
      .reduce((sum, l) => sum + (l.valueUsd * l.apy) / 36500, 0) || 0;
  const dailyYield = stakingYield + vaultYield + lendingYield;

  const allPositionCount =
    staking.length +
    vaults.length +
    lending.length +
    liquidity.length;

  const allProtocols = new Set([
    ...staking.map((s) => s.protocol),
    ...vaults.map((v) => v.vaultName),
    ...lending.map((l) => l.protocol),
    ...(liquidity.length ? ["Uniswap V3"] : []),
  ]);

  return {
    tokens,
    staking,
    vaults,
    lending,
    liquidity,
    totalValue,
    totalTokenValue,
    totalStakingValue,
    dailyYield,
    positionCount: allPositionCount,
    protocolCount: allProtocols.size,
    isLoading: portfolio.isLoading,
    isError: portfolio.isError,
    updatedAt:
      portfolio.data?.meta?.fetchedAt ||
      portfolio.data?.updatedAt ||
      portfolio.dataUpdatedAt,
    cacheStatus: portfolio.data?.meta?.cacheStatus,
    refetch: () => {
      portfolio.refetch();
    },
  };
}
