import { fetchLendingPositions, type LendingPosition } from "@/services/lending";
import { fetchLiquidityPositions, type LiquidityPosition } from "@/services/liquidity";
import { fetchStakingPositions, type StakingPosition } from "@/services/staking";
import {
  fetchTokenBalances,
  type TokenBalance,
} from "@/services/tokens";
import { fetchVaultPositions, type VaultPosition } from "@/services/vaults";

export interface SerializedTokenBalance extends Omit<TokenBalance, "balance"> {
  balance: string;
}

export interface PortfolioSnapshot {
  tokens: SerializedTokenBalance[];
  staking: StakingPosition[];
  vaults: VaultPosition[];
  lending: LendingPosition[];
  liquidity: LiquidityPosition[];
  updatedAt: number;
}

export function serializeTokenBalances(tokens: TokenBalance[]): SerializedTokenBalance[] {
  return tokens.map((token) => ({
    ...token,
    balance: token.balance.toString(),
  }));
}

export function deserializeTokenBalances(tokens: SerializedTokenBalance[]): TokenBalance[] {
  return tokens.map((token) => ({
    ...token,
    balance: BigInt(token.balance),
  }));
}

export async function fetchPortfolioSnapshot(
  address: `0x${string}`
): Promise<PortfolioSnapshot> {
  const [tokens, staking, vaults, lending, liquidity] = await Promise.all([
    fetchTokenBalances(address),
    fetchStakingPositions(address),
    fetchVaultPositions(address),
    fetchLendingPositions(address),
    fetchLiquidityPositions(address),
  ]);

  return {
    tokens: serializeTokenBalances(tokens),
    staking,
    vaults,
    lending,
    liquidity,
    updatedAt: Date.now(),
  };
}
