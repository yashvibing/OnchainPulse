// ─── Contract ABIs ───
// Minimal ABIs for on-chain reads. Only include methods we actually call.

export const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const WMON_ABI = [
  ...ERC20_ABI,
  {
    inputs: [],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "wad", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const ERC4626_ABI = [
  ...ERC20_ABI,
  {
    inputs: [{ name: "shares", type: "uint256" }],
    name: "convertToAssets",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalAssets",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "asset",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Kintsu's StakedMonadV2 — same shape as ERC-4626 but uses uint96 instead of
// uint256 for the share amount, which produces a different function selector.
// Don't merge this into ERC4626_ABI: viem dispatches by function selector and
// having two `convertToAssets` entries with different param types in one ABI
// causes ambiguity errors.
export const KINTSU_LST_ABI = [
  ...ERC20_ABI,
  {
    inputs: [{ name: "shares", type: "uint96" }],
    name: "convertToAssets",
    outputs: [{ name: "", type: "uint96" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Euler-style vault with debt tracking
export const EULER_VAULT_ABI = [
  ...ERC4626_ABI,
  {
    inputs: [{ name: "account", type: "address" }],
    name: "debtOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Curve Factory — pool_count + pool_list for enumeration. Both StableSwap
// and Twocrypto/Tricrypto factories share the same factory ABI for these.
export const CURVE_FACTORY_ABI = [
  {
    inputs: [],
    name: "pool_count",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "i", type: "uint256" }],
    name: "pool_list",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Curve Pool — minimal LP / coin / balance interface. Curve pools are also
// ERC-20 LP tokens, so balanceOf/totalSupply come from ERC20_ABI.
// We use coins(uint256) and balances(uint256) to enumerate underlying tokens.
export const CURVE_POOL_ABI = [
  ...ERC20_ABI,
  {
    inputs: [{ name: "i", type: "uint256" }],
    name: "coins",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "i", type: "uint256" }],
    name: "balances",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "N_COINS",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Uniswap V3 Factory — only the getPool method we need
export const UNI_V3_FACTORY_ABI = [
  {
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    name: "getPool",
    outputs: [{ name: "pool", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Uniswap V3 Pool — only slot0 (current price + tick)
export const UNI_V3_POOL_ABI = [
  {
    inputs: [],
    name: "slot0",
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Uniswap V3 NonfungiblePositionManager
export const UNI_V3_NFT_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    name: "tokenOfOwnerByIndex",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "positions",
    outputs: [
      { name: "nonce", type: "uint96" },
      { name: "operator", type: "address" },
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
      { name: "tokensOwed0", type: "uint128" },
      { name: "tokensOwed1", type: "uint128" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Morpho Blue
export const MORPHO_ABI = [
  {
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "user", type: "address" },
    ],
    name: "position",
    outputs: [
      { name: "supplyShares", type: "uint256" },
      { name: "borrowShares", type: "uint128" },
      { name: "collateral", type: "uint128" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "id", type: "bytes32" }],
    name: "market",
    outputs: [
      { name: "totalSupplyAssets", type: "uint128" },
      { name: "totalSupplyShares", type: "uint128" },
      { name: "totalBorrowAssets", type: "uint128" },
      { name: "totalBorrowShares", type: "uint128" },
      { name: "lastUpdate", type: "uint128" },
      { name: "fee", type: "uint128" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
