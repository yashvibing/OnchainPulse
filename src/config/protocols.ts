// ─── Protocol Registry ───
// Contract addresses for DeFi protocols on Monad.
// Source: https://github.com/monad-crypto/protocols
//
// TODO: Replace placeholder addresses (0x000...TODO) with real ones
// from the protocols repo before going to production.

export interface StakingProtocol {
  name: string;
  lstToken: `0x${string}`;
  lstSymbol: string;
  color: string;
  // Some protocols use ERC-4626, others have custom methods
  exchangeRateMethod: "convertToAssets" | "getPooledMonByShares";
}

export interface LendingProtocol {
  name: string;
  address: `0x${string}`;
  type: "morpho" | "euler" | "aave-like";
  color: string;
}

export interface YieldVault {
  name: string;
  vaultAddress: `0x${string}`;
  underlyingSymbol: string;
  color: string;
}

// ─── Liquid Staking ───
export const STAKING_PROTOCOLS: StakingProtocol[] = [
  {
    name: "aPriori",
    lstToken: "0x0c65A0BC65a5D819235B71F554D210D3F80E0852",
    lstSymbol: "aprMON",
    color: "#6D28D9",
    exchangeRateMethod: "convertToAssets",
  },
  {
    name: "FastLane",
    lstToken: "0x1B68626dCa36c7fE922fD2d55E4f631d962dE19c",
    lstSymbol: "shMON",
    color: "#D97706",
    exchangeRateMethod: "convertToAssets",
  },
  // TODO: Add Kintsu, Magma once contract addresses confirmed
];

// ─── Lending ───
// NOTE: Morpho address is the core contract (needs market IDs, not balanceOf).
// Euler address is the eVaultFactory, not an actual vault — balanceOf reverts.
// Both are disabled until real user-facing vault addresses are discovered.
export const LENDING_PROTOCOLS: LendingProtocol[] = [];

// ─── Yield Vaults (Upshift) ───
// NOTE: These addresses may be proxies that don't directly support ERC-4626.
// Disabled until correct vault implementation addresses are confirmed.
export const YIELD_VAULTS: YieldVault[] = [];

// ─── DEX / LP ───
// Uniswap V3 NonfungiblePositionManager on Monad
export const UNISWAP_V3_POSITION_MANAGER =
  "0x7197E214c0b767cFB76Fb734ab638E2c192F4E53" as `0x${string}`;
