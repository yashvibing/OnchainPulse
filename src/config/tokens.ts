// ─── Known tokens on Monad Mainnet ───
// Source: https://github.com/monad-crypto/token-list
// and https://github.com/monad-crypto/protocols
//
// NOTE: Verify these addresses against the official repos before production use.
// Some addresses may have changed since this file was created.

export interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  category: "native" | "stablecoin" | "lst" | "wrapped" | "defi";
  logoColor?: string;
  logoURI?: string;
}

// Native MON doesn't have a contract address — it's the gas token
// We use a sentinel value for internal tracking
export const NATIVE_MON: TokenInfo = {
  address: "0x0000000000000000000000000000000000000000",
  symbol: "MON",
  name: "Monad",
  decimals: 18,
  category: "native",
  logoColor: "#6D3BF5",
  logoURI: "/monad-logomark.svg",
};

export const TOKENS: Record<string, TokenInfo> = {
  WMON: {
    address: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
    symbol: "WMON",
    name: "Wrapped MON",
    decimals: 18,
    category: "wrapped",
    logoColor: "#5B2FD6",
    logoURI: "/monad-logomark.svg",
  },
  USDC: {
    address: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    category: "stablecoin",
    logoColor: "#2775CA",
  },
  // The token at this address is USDT0 (LayerZero Omnichain USDT), not Tether's
  // native USDT. Verified on-chain 2026-04-11: symbol() returns "USDT0",
  // name() returns "USDT0". This is the canonical bridged USDT on Monad.
  USDT0: {
    address: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
    symbol: "USDT0",
    name: "USDT0",
    decimals: 6,
    category: "stablecoin",
    logoColor: "#26A17B",
  },
  WETH: {
    address: "0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242",
    symbol: "WETH",
    name: "Wrapped ETH",
    decimals: 18,
    category: "wrapped",
    logoColor: "#627EEA",
  },
  WBTC: {
    address: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
    symbol: "WBTC",
    name: "Wrapped BTC",
    decimals: 8,
    category: "wrapped",
    logoColor: "#F7931A",
  },
  // Coinbase Wrapped BTC — used as the underlying for several Morpho vaults
  // on Monad (Hyperithm cbBTC Apex, Steakhouse High Yield cbBTC).
  // Verified on-chain 2026-04-11.
  cbBTC: {
    address: "0xd18B7EC58Cdf4876f6AFebd3Ed1730e4Ce10414b",
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    decimals: 8,
    category: "wrapped",
    logoColor: "#0052FF",
  },
  // World Liberty Financial USD — stablecoin used by Morpho's bbqUSD1 vault.
  // Verified on-chain 2026-04-11: name() = "World Liberty Financial USD".
  USD1: {
    address: "0x111111d2bf19e43C34263401e0CAd979eD1cdb61",
    symbol: "USD1",
    name: "World Liberty Financial USD",
    decimals: 6,
    category: "stablecoin",
    logoColor: "#FCD34D",
  },
  AUSD: {
    address: "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a",
    symbol: "AUSD",
    name: "Agora USD",
    decimals: 6,
    category: "stablecoin",
    logoColor: "#1A73E8",
  },

  // ─── Liquid Staking Tokens ───
  aprMON: {
    address: "0x0c65A0BC65a5D819235B71F554D210D3F80E0852",
    symbol: "aprMON",
    name: "aPriori Staked MON",
    decimals: 18,
    category: "lst",
    logoColor: "#6D28D9",
  },
  shMON: {
    address: "0x1B68626dCa36c7fE922fD2d55E4f631d962dE19c",
    symbol: "shMON",
    name: "FastLane Staked MON",
    decimals: 18,
    category: "lst",
    logoColor: "#D97706",
  },
  // Note: Kintsu's on-chain symbol is sMON, not kMON. The community
  // historically called it "kMON" but the actual ERC-20 reports "sMON".
  sMON: {
    address: "0xA3227C5969757783154C60bF0bC1944180ed81B9",
    symbol: "sMON",
    name: "Kintsu Staked Monad",
    decimals: 18,
    category: "lst",
    logoColor: "#EC4899",
  },
  gMON: {
    address: "0x8498312A6B3CbD158bf0c93AbdCF29E6e4F55081",
    symbol: "gMON",
    name: "gMON",
    decimals: 18,
    category: "lst",
    logoColor: "#F97316",
  },
};

// All ERC-20 addresses for batch balance queries
export const ALL_TOKEN_ADDRESSES = Object.values(TOKENS).map((t) => t.address);

// Lookup helpers
export function getTokenByAddress(address: string): TokenInfo | undefined {
  return Object.values(TOKENS).find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
}

export function getTokenBySymbol(symbol: string): TokenInfo | undefined {
  return TOKENS[symbol];
}
