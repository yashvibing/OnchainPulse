import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { monad } from "@/config/chain";

export const wagmiConfig = getDefaultConfig({
  appName: "Onchain Pulse",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "onchain-pulse-demo",
  chains: [monad],
  ssr: true,
});
