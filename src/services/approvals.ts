import { getAddress, formatUnits } from "viem";
import { monadClient } from "@/lib/client";
import { ERC20_ABI } from "@/lib/abis";
import { TOKENS, getTokenByAddress, type TokenInfo } from "@/config/tokens";

// ─── Types ───

export interface TokenApproval {
  token: TokenInfo;
  spender: `0x${string}`;
  spenderLabel: string;
  allowance: bigint;
  allowanceFormatted: string;
  isUnlimited: boolean;
  riskLevel: "high" | "medium" | "low";
}

// Threshold for "unlimited" — anything above 2^128 is effectively unlimited
const UNLIMITED_THRESHOLD = 2n ** 128n;

// Known protocol labels for common spender addresses
const KNOWN_SPENDERS: Record<string, string> = {
  "0xd5d960e8c380b724a48ac59e2dff1b2cb4a1eaee": "Morpho Blue",
  "0x80f00661b13cc5f6ccd3885be7b4c9c67545d585": "Neverland Pool",
  "0x7197e214c0b767cfb76fb734ab638e2c192f4e53": "Uniswap V3 NFT Manager",
  "0x000000000022d473030f116ddee9f6b43ac78ba3": "Permit2",
  "0x1e240e30e51491546dec3af16b0b4eac8dd110d4": "Curvance cWMON",
  "0x926c101cf0a3de8725eb24a93e980f9fe34d6230": "Curvance cshMON",
  "0x494876051b0e85dce5ecd5822b1ad39b9660c928": "Curvance csMON",
  "0xd9e2025b907e95ecc963a5018f56b87575b4ab26": "Curvance caprMON",
  "0x21adbb60a5fb909e7f1fb48aacc4569615cd97b5": "Curvance cUSDC",
  "0x103222f020e98bba0ad9809a011fdf8e6f067496": "Upshift earnAUSD",
};

function getSpenderLabel(address: string): string {
  return KNOWN_SPENDERS[address.toLowerCase()] || shortenAddr(address);
}

function shortenAddr(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// ─── Fetch approvals via Approval event logs ───
//
// Scan Approval(owner, spender, value) events for the wallet across all
// known tokens. Then verify the current on-chain allowance (approvals can
// be overwritten, so the latest log might not reflect the current state).

const APPROVAL_TOPIC =
  "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
const LOG_RPC = "https://monad-mainnet.drpc.org";
const CHUNK_SIZE = 500;
const LOOKBACK_BLOCKS = 500_000; // ~5.8 days, wide enough to catch most approvals

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(LOG_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

export async function fetchTokenApprovals(
  walletAddress: `0x${string}`
): Promise<TokenApproval[]> {
  const normalizedWallet = getAddress(walletAddress);
  const tokenAddrs = Object.values(TOKENS).map((t) => t.address);
  if (tokenAddrs.length === 0) return [];

  // Wallet as topic[1] (owner)
  const ownerTopic =
    "0x" + "0".repeat(24) + walletAddress.slice(2).toLowerCase();

  // Discover unique (token, spender) pairs from Approval logs
  const spendersByToken = new Map<string, Set<string>>();

  try {
    const latestHex = await rpcCall<string>("eth_blockNumber", []);
    const latest = parseInt(latestHex, 16);
    const earliest = Math.max(0, latest - LOOKBACK_BLOCKS);
    const numChunks = Math.ceil((latest - earliest) / CHUNK_SIZE);

    // Scan in parallel chunks
    const fetches = [];
    for (let i = 0; i < numChunks; i++) {
      const lo = latest - (i + 1) * CHUNK_SIZE + 1;
      const hi = latest - i * CHUNK_SIZE;
      fetches.push(
        rpcCall<
          { address: string; topics: string[] }[]
        >("eth_getLogs", [
          {
            address: tokenAddrs,
            topics: [APPROVAL_TOPIC, ownerTopic, null],
            fromBlock: "0x" + Math.max(lo, earliest).toString(16),
            toBlock: "0x" + hi.toString(16),
          },
        ]).catch(() => [])
      );
    }

    const results = await Promise.allSettled(fetches);
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const log of r.value) {
        const tokenAddr = log.address.toLowerCase();
        const spender = "0x" + log.topics[2].slice(26);
        if (!spendersByToken.has(tokenAddr)) {
          spendersByToken.set(tokenAddr, new Set());
        }
        spendersByToken.get(tokenAddr)!.add(spender.toLowerCase());
      }
    }
  } catch {
    // If log scanning fails, fall back to checking common spenders
    const commonSpenders = Object.keys(KNOWN_SPENDERS);
    for (const token of tokenAddrs) {
      spendersByToken.set(
        token.toLowerCase(),
        new Set(commonSpenders)
      );
    }
  }

  if (spendersByToken.size === 0) return [];

  // Build multicall to check current allowance for each (token, spender) pair
  const pairs: { token: TokenInfo; spender: `0x${string}` }[] = [];
  for (const [tokenAddr, spenders] of spendersByToken) {
    const tokenInfo = getTokenByAddress(tokenAddr);
    if (!tokenInfo) continue;
    for (const spender of spenders) {
      pairs.push({
        token: tokenInfo,
        spender: getAddress(spender) as `0x${string}`,
      });
    }
  }

  if (pairs.length === 0) return [];

  const calls = pairs.map(({ token, spender }) => ({
    address: getAddress(token.address),
    abi: ERC20_ABI,
    functionName: "allowance" as const,
    args: [normalizedWallet, spender] as const,
  }));

  const results = await monadClient.multicall({ contracts: calls });

  const approvals: TokenApproval[] = [];
  results.forEach((r, i) => {
    if (r.status !== "success") return;
    const allowance = r.result as bigint;
    if (allowance === 0n) return; // No active approval

    const { token, spender } = pairs[i];
    const isUnlimited = allowance >= UNLIMITED_THRESHOLD;
    const formatted = isUnlimited
      ? "Unlimited"
      : formatUnits(allowance, token.decimals);

    approvals.push({
      token,
      spender,
      spenderLabel: getSpenderLabel(spender),
      allowance,
      allowanceFormatted: formatted,
      isUnlimited,
      riskLevel: isUnlimited ? "high" : allowance > 0n ? "medium" : "low",
    });
  });

  // Sort: high risk first, then by token
  approvals.sort((a, b) => {
    const riskOrder = { high: 0, medium: 1, low: 2 };
    if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    }
    return a.token.symbol.localeCompare(b.token.symbol);
  });

  return approvals;
}
