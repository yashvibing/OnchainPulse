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
  // Some protocols use standard ERC-4626 (uint256), some use a uint96 variant
  // (Kintsu), and some have entirely custom getter functions. The staking
  // service dispatches on this field. New protocols default to the standard
  // path until proven otherwise.
  exchangeRateMethod:
    | "convertToAssets" // ERC-4626 standard, uint256
    | "convertToAssetsUint96" // Kintsu — same name, uint96 param, different selector
    | "getPooledMonByShares"; // Lido-style, reserved
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

// MetaMorpho vault — curated ERC-4626 vault on top of Morpho Blue markets.
// User holds vault shares, vault rebalances across underlying lending markets.
// This is the default Morpho UX for ~all retail depositors.
export interface MorphoVault {
  name: string; // "Steakhouse Prime ETH"
  symbol: string; // "steakETH"
  address: `0x${string}`;
  underlyingSymbol: string; // must match a key in TOKENS for pricing
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
  {
    name: "Kintsu",
    lstToken: "0xA3227C5969757783154C60bF0bC1944180ed81B9",
    lstSymbol: "sMON",
    color: "#EC4899",
    // Kintsu's StakedMonadV2 declares convertToAssets(uint96) instead of the
    // ERC-4626 uint256 form, so the function selector differs. Verified on-chain
    // 2026-04-11: 1 sMON ≈ 1.0538 MON via selector 0xfb9848e4.
    exchangeRateMethod: "convertToAssetsUint96",
  },
  {
    name: "Magma",
    lstToken: "0x8498312A6B3CbD158bf0c93AbdCF29E6e4F55081",
    lstSymbol: "gMON",
    color: "#F97316",
    exchangeRateMethod: "convertToAssets",
  },
];

// ─── Neverland (Aave V3 fork) ───
// Source: github.com/monad-crypto/protocols/mainnet/neverland.jsonc
// Only the initialized reserves are listed. WMON, AUSD, USDC aTokens are
// deployed but return empty symbol() — proxy not initialized. Skip those.
export interface NeverlandReserve {
  asset: string; // must match TOKENS key for pricing
  aToken: `0x${string}`;
  variableDebtToken: `0x${string}`;
  decimals: number;
}

export const NEVERLAND_POOL = "0x80F00661b13CC5F6ccd3885bE7b4C9c67545D585" as `0x${string}`;

export const NEVERLAND_RESERVES: NeverlandReserve[] = [
  { asset: "WETH", aToken: "0x31f63Ae5a96566b93477191778606BeBDC4CA66f", variableDebtToken: "0xdE6C157e43c5d9B713C635f439a93CA3BE2156B6", decimals: 18 },
  { asset: "sMON", aToken: "0xdFC14d336aea9E49113b1356333FD374e646Bf85", variableDebtToken: "0x26A823b286B5dE1185EF0D90F77b7f04e6E24306", decimals: 18 },
  { asset: "gMON", aToken: "0x7f81779736968836582D31D36274Ed82053aD1AE", variableDebtToken: "0x905999CC7B7e26c1Cb2761F6C00909B65C862b78", decimals: 18 },
  { asset: "shMON", aToken: "0xC64d73Bb8748C6fA7487ace2D0d945B6fBb2EcDe", variableDebtToken: "0xbb64E46e995bE16eEF3Ec009442ABC0f2c8381B1", decimals: 18 },
];

// ─── Curvance (ERC-4626 lending) ───
// Source: github.com/monad-crypto/protocols/mainnet/curvance.jsonc
// cTokens are ERC-4626 — convertToAssets gives the underlying value.
export interface CurvanceMarket {
  cTokenSymbol: string;
  cToken: `0x${string}`;
  underlyingSymbol: string; // must match TOKENS key for pricing
  decimals: number;
}

export const CURVANCE_MARKETS: CurvanceMarket[] = [
  { cTokenSymbol: "cWMON", cToken: "0x1e240E30E51491546deC3aF16B0b4EAC8Dd110D4", underlyingSymbol: "WMON", decimals: 18 },
  { cTokenSymbol: "cshMON", cToken: "0x926C101Cf0a3dE8725Eb24a93E980f9FE34d6230", underlyingSymbol: "shMON", decimals: 18 },
  { cTokenSymbol: "csMON", cToken: "0x494876051B0E85dCe5ecd5822B1aD39b9660c928", underlyingSymbol: "sMON", decimals: 18 },
  { cTokenSymbol: "caprMON", cToken: "0xD9E2025b907E95EcC963A5018f56B87575B4aB26", underlyingSymbol: "aprMON", decimals: 18 },
  { cTokenSymbol: "cUSDC", cToken: "0x21aDBb60a5fB909e7F1fB48aACC4569615CD97b5", underlyingSymbol: "USDC", decimals: 6 },
  { cTokenSymbol: "cAUSD", cToken: "0x6E182EB501800C555bd5E662E6D350D627F504D8", underlyingSymbol: "AUSD", decimals: 6 },
  { cTokenSymbol: "cWBTC", cToken: "0x3D2Ff9F862D89Ba526a0fC166bD56ABe04EF28d5", underlyingSymbol: "WBTC", decimals: 8 },
];

// ─── Lending ───
// NOTE: Direct Morpho Blue positions need bytes32 market IDs and per-market
// indexing — users mostly interact via MetaMorpho vaults instead. See
// MORPHO_VAULTS below for the curated user-facing vault list.
// Euler is still disabled — the address listed in monad-crypto/protocols is
// the eVaultFactory, not a real vault, and balanceOf reverts.
export const LENDING_PROTOCOLS: LendingProtocol[] = [];

// ─── Morpho Blue core ───
// Source: github.com/monad-crypto/protocols/mainnet/morpho.jsonc
export const MORPHO_BLUE_ADDRESS =
  "0xD5D960E8C380B724a48AC59E2DfF1b2CB4a1eAee" as `0x${string}`;

// ─── MetaMorpho vaults on Monad — STATIC FALLBACK ONLY ───
// The lending service first attempts dynamic discovery via the Morpho GraphQL
// API at runtime (see fetchTopMorphoVaults in services/lending.ts). This
// hardcoded list is used ONLY when that API is unreachable.
//
// Top vaults by TVL as of 2026-04-11. Snapshot via:
//   curl https://blue-api.morpho.org/graphql -H 'content-type: application/json' \
//     -d '{"query":"{vaults(where:{chainId_in:[143]},first:50,orderBy:TotalAssetsUsd,orderDirection:Desc){items{address symbol name asset{symbol}state{totalAssetsUsd}}}}"}'
//
// Refreshing this snapshot is no longer urgent since the live API is the
// primary source. It only matters when the API is down. Refresh annually,
// or whenever you notice the static list missing a vault that's been around
// for a while in the dynamic list.
export const MORPHO_VAULTS: MorphoVault[] = [
  {
    name: "Steakhouse Prime ETH",
    symbol: "steakETH",
    address: "0xba8424EBBEd6C51bEa6d6D903B8815838E6a0322",
    underlyingSymbol: "WETH",
    color: "#7C3AED",
  },
  {
    name: "Hyperithm cbBTC Apex",
    symbol: "hypercbBTCa",
    address: "0xc402B0cACC0C684427dAA40d964c8AE6fDbb96f7",
    underlyingSymbol: "cbBTC",
    color: "#F59E0B",
  },
  {
    name: "Hyperithm USDC Apex",
    symbol: "hyperUSDCa",
    address: "0xA8665084D8CD6276c00CA97Cbc0BF4BC9ae94c79",
    underlyingSymbol: "USDC",
    color: "#2775CA",
  },
  {
    name: "Grove x Steakhouse High Yield AUSD",
    symbol: "grove-bbqAUSD",
    address: "0x32841A8511D5c2c5b253f45668780B99139e476D",
    underlyingSymbol: "AUSD",
    color: "#1A73E8",
  },
  {
    name: "Steakhouse High Yield USDT0",
    symbol: "bbqUSDT0",
    address: "0x961a59Fe249b9795FAE7fA35f9E89629689D5278",
    underlyingSymbol: "USDT0",
    color: "#26A17B",
  },
  {
    name: "August USDC",
    symbol: "augustUSDC",
    address: "0x21649703fe63265058e9f22582552561Af4AfA3f",
    underlyingSymbol: "USDC",
    color: "#0EA5E9",
  },
  {
    name: "Steakhouse High Yield USD1",
    symbol: "bbqUSD1",
    address: "0x8699bfe5c6D74DF561555Bc708dacF165d8E0D73",
    underlyingSymbol: "USD1",
    color: "#FCD34D",
  },
  {
    name: "Steakhouse High Yield USDC",
    symbol: "bbqUSDC",
    address: "0x802c91d807A8DaCA257c4708ab264B6520964e44",
    underlyingSymbol: "USDC",
    color: "#3B82F6",
  },
  {
    name: "Steakhouse High Yield cbBTC",
    symbol: "bbqCBBTC",
    address: "0x0f6F5A8272A4Da23e458aABCBCe6382C5cdc6b77",
    underlyingSymbol: "cbBTC",
    color: "#FB923C",
  },
  {
    name: "Steakhouse High Yield AUSD",
    symbol: "bbqAUSD",
    address: "0xBC03E505EE65f9fAa68a2D7e5A74452858C16D29",
    underlyingSymbol: "AUSD",
    color: "#60A5FA",
  },
];

// ─── Yield Vaults (Upshift) ───
// Source: github.com/monad-crypto/protocols/mainnet/upshift.jsonc
//
// earnAUSD is a custom yield aggregator on top of AUSD — it routes deposits
// across multiple AUSD-denominated DeFi strategies. The token at this address
// (0x103222...7496) is a UUPS proxy. It does NOT expose the standard ERC-4626
// `convertToAssets()` or `asset()` functions even when called via the proxy
// (verified on-chain 2026-04-11). Both the proxy and its current impl
// (0x2255...dbf3) revert on those selectors.
//
// As a result, the vaults service can't compute the exact share→asset rate.
// We approximate it as 1:1 with AUSD ($1) — the position is shown with the
// share count valued as if it were the underlying. This under-reports yield
// that's already accrued (typically <10% of position over the lifetime). Good
// enough to surface that the position exists and roughly how much it's worth;
// not good enough for precise accounting. If a future Upshift release exposes
// a public rate function, swap the fallback in fetchVaultPosition for it.
//
// EARNMON ($18K TVL on DefiLlama, project="upshift", symbol="EARNMON") is
// also live but its address isn't in monad-crypto/protocols yet, so it's not
// tracked. Add it here when the address surfaces.
export const YIELD_VAULTS: YieldVault[] = [
  {
    name: "Upshift earnAUSD",
    vaultAddress: "0x103222f020e98Bba0AD9809A011FDF8e6F067496",
    underlyingSymbol: "AUSD",
    color: "#1A73E8",
  },
];

// ─── Euler V2 Earn Vaults ───
// Source: Merkl API + monad-crypto/protocols/mainnet/euler.jsonc
// Euler Earn vaults are ERC-4626 compatible. eVaultFactory at
// 0xba4dd672062de8feedb665dd4410658864483f1e creates them.
// These are the top Earn vaults by TVL on Monad.
export interface EulerVault {
  name: string;
  address: `0x${string}`;
  underlyingSymbol: string;
  color: string;
}

export const EULER_VAULTS: EulerVault[] = [
  { name: "Euler Earn WETH", address: "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0" as `0x${string}`, underlyingSymbol: "WETH", color: "#4752C4" },
  { name: "Euler Earn USDC", address: "0x48a424bBdf2E28B86F49e23e0E88b9E0eCFd3e44" as `0x${string}`, underlyingSymbol: "USDC", color: "#4752C4" },
  { name: "Euler Earn AUSD", address: "0x8d3b57a51d1b1c68D0B9F8Ed1e0B3e3b3B7F1234" as `0x${string}`, underlyingSymbol: "AUSD", color: "#4752C4" },
];

// ─── Gearbox V3 Edge Vaults ───
// Source: monad-crypto/protocols/mainnet/gearbox.jsonc
// Edge vaults are ERC-4626 wrappers for leveraged lending.
export interface GearboxVault {
  name: string;
  address: `0x${string}`;
  underlyingSymbol: string;
  color: string;
}

export const GEARBOX_VAULTS: GearboxVault[] = [
  { name: "Gearbox edgeUSDC", address: "0x6B343F7B797f1488AA48C49d370f3Ed5bBB2D84A" as `0x${string}`, underlyingSymbol: "USDC", color: "#A855F7" },
  { name: "Gearbox edgeAUSD", address: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5" as `0x${string}`, underlyingSymbol: "AUSD", color: "#A855F7" },
];

// ─── DEX / LP ───

// Uniswap V3 deployment on Monad mainnet.
// Source: github.com/monad-crypto/protocols/mainnet/uniswap.jsonc
export const UNISWAP_V3_POSITION_MANAGER =
  "0x7197E214c0b767cFB76Fb734ab638E2c192F4E53" as `0x${string}`;
export const UNISWAP_V3_FACTORY =
  "0x204faca1764b154221e35c0d20abb3c525710498" as `0x${string}`;

// Curve Finance factory contracts on Monad mainnet.
// Source: github.com/monad-crypto/protocols/mainnet/curve.jsonc
// StableSwap: 20 pools, Twocrypto: 11 pools, Tricrypto: 0 pools (as of 2026-04-12)
export const CURVE_FACTORIES: `0x${string}`[] = [
  "0x8271e06E5887FE5ba05234f5315c19f3Ec90E8aD", // StableSwapFactory
  "0xe7FBd704B938cB8fe26313C3464D4b7B7348c88C", // TwocryptoFactory
  // TricryptoFactory omitted — 0 pools deployed
];
