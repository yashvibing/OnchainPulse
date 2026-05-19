import { defineChain } from "viem";

const PUBLIC_MONAD_RPC_URL =
  process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://rpc.monad.xyz";

// ─── Monad Mainnet (Chain ID 143) ───
export const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [PUBLIC_MONAD_RPC_URL],
    },
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://monadvision.com" },
    monadscan: { name: "Monadscan", url: "https://monadscan.com" },
    socialscan: { name: "Socialscan", url: "https://monad.socialscan.io" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
});

// ─── Canonical contract addresses ───
export const CONTRACTS = {
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11" as `0x${string}`,
  wmon: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A" as `0x${string}`,
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as `0x${string}`,
} as const;
