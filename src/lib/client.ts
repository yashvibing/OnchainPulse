import { createPublicClient, http } from "viem";
import { monad } from "@/config/chain";

// ─── Monad Public Client ───
// Singleton viem client for read-only RPC calls.

export const monadClient = createPublicClient({
  chain: monad,
  transport: http(
    process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://rpc.monad.xyz"
  ),
  // NOTE: Multicall3 on Monad returns empty data for some contracts.
  // Disabled auto-batching; individual RPC calls work reliably.
});
