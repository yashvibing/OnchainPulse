// ─── Recent token transfer history ───
//
// Pulls the user's recent token transfers (in + out) by querying ERC-20
// `Transfer` events via eth_getLogs. Scoped to tokens we know about
// (TOKENS registry) — unknown tokens won't appear, and native MON transfers
// won't appear either (no Transfer event for native value moves).
//
// Why this approach instead of an indexer:
//   - Works without an API key (BlockVision/Alchemy/etc. all require one).
//   - Verifiable end-to-end against any wallet on Monad mainnet.
//   - Limited to a recent block window because public RPCs cap getLogs
//     to a few hundred blocks per request.
//
// Why drpc.org instead of the user's configured RPC:
//   - rpc.monad.xyz limits eth_getLogs to a 100-block range.
//   - monad-mainnet.drpc.org allows 500-block ranges (verified 2026-04-12).
//   - 5x larger window per request = 5x fewer chunks for the same lookback.
//   - We use the user's RPC for everything else; this one query goes to drpc
//     because it's the right tool for the job. No env var needed.
//
// Tradeoff: ~30-90 minutes of history depending on chain activity. Good
// enough for "what just happened to my wallet". For deeper history, the
// upgrade path is BlockVision (BLOCKVISION_API_KEY) — see CLAUDE.md.

import { formatUnits } from "viem";
import { TOKENS, NATIVE_MON, getTokenByAddress } from "@/config/tokens";

const LOG_RPC = "https://monad-mainnet.drpc.org";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const CHUNK_SIZE = 500; // drpc.org's getLogs range cap
const DEFAULT_LOOKBACK_BLOCKS = 4000; // ~70 min on Monad's ~1s blocks

export interface TransferEvent {
  blockNumber: number;
  txHash: `0x${string}`;
  logIndex: number;
  timestamp: number | null; // unix seconds, null if we couldn't fetch
  direction: "in" | "out";
  tokenSymbol: string;
  tokenAddress: `0x${string}`;
  // Display-formatted (e.g. "1234.56" or "0.000123")
  amount: string;
  // Raw amount as bigint string (so we can sort/aggregate without precision loss)
  amountRaw: string;
  // Counterparty: the OTHER side of the transfer (sender if direction=in,
  // recipient if direction=out)
  counterparty: `0x${string}`;
}

interface JsonRpcLog {
  address: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  topics: string[];
  data: string;
}

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

// Fetch one chunk of Transfer logs filtered by topic[1] (sender) or
// topic[2] (recipient). Returns [] on chunk-level errors so a single bad
// chunk doesn't kill the whole history.
async function fetchLogChunk(
  fromBlock: number,
  toBlock: number,
  tokenAddrs: `0x${string}`[],
  walletTopic: string,
  topicSlot: 1 | 2
): Promise<JsonRpcLog[]> {
  const topics: (string | null)[] = [TRANSFER_TOPIC, null, null];
  topics[topicSlot] = walletTopic;
  try {
    const logs = await rpcCall<JsonRpcLog[]>("eth_getLogs", [
      {
        address: tokenAddrs,
        topics,
        fromBlock: "0x" + fromBlock.toString(16),
        toBlock: "0x" + toBlock.toString(16),
      },
    ]);
    return logs;
  } catch {
    return [];
  }
}

// Fetch block timestamps in parallel for a set of unique block numbers.
// Returns a map {blockNumber → unix seconds}. Missing blocks map to null.
async function fetchBlockTimestamps(
  blockNumbers: number[]
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const calls = blockNumbers.map((bn) =>
    rpcCall<{ timestamp: string } | null>("eth_getBlockByNumber", [
      "0x" + bn.toString(16),
      false,
    ])
      .then((b) => {
        if (b?.timestamp) out.set(bn, parseInt(b.timestamp, 16));
      })
      .catch(() => {
        /* leave unmapped */
      })
  );
  await Promise.all(calls);
  return out;
}

export async function fetchTokenTransferHistory(
  walletAddress: `0x${string}`,
  options: { lookbackBlocks?: number; limit?: number } = {}
): Promise<TransferEvent[]> {
  const lookback = options.lookbackBlocks ?? DEFAULT_LOOKBACK_BLOCKS;
  const limit = options.limit ?? 50;

  // All ERC-20 token addresses we know about. Native MON has no contract
  // address so it's excluded — there's no Transfer event for it.
  const tokenAddrs: `0x${string}`[] = Object.values(TOKENS).map(
    (t) => t.address
  );
  if (tokenAddrs.length === 0) return [];

  // ABI-encoded "address" topic = 32 bytes left-padded with zeros.
  const walletTopic =
    "0x" + "0".repeat(24) + walletAddress.slice(2).toLowerCase();

  // Get latest block, then build the chunk list.
  const latestHex = await rpcCall<string>("eth_blockNumber", []);
  const latest = parseInt(latestHex, 16);
  const earliest = Math.max(0, latest - lookback);
  const numChunks = Math.ceil((latest - earliest) / CHUNK_SIZE);

  const chunkRanges: Array<[number, number]> = [];
  for (let i = 0; i < numChunks; i++) {
    const lo = latest - (i + 1) * CHUNK_SIZE + 1;
    const hi = latest - i * CHUNK_SIZE;
    chunkRanges.push([Math.max(lo, earliest), hi]);
  }

  // Fire all chunks for both directions in parallel. Use allSettled so a
  // single bad chunk (e.g. "Unknown block" from drpc) doesn't lose the rest.
  const fetches: Promise<{ logs: JsonRpcLog[]; direction: "in" | "out" }>[] =
    [];
  for (const [lo, hi] of chunkRanges) {
    fetches.push(
      fetchLogChunk(lo, hi, tokenAddrs, walletTopic, 2).then((logs) => ({
        logs,
        direction: "in" as const,
      }))
    );
    fetches.push(
      fetchLogChunk(lo, hi, tokenAddrs, walletTopic, 1).then((logs) => ({
        logs,
        direction: "out" as const,
      }))
    );
  }
  const settled = await Promise.allSettled(fetches);

  // Flatten + dedupe by (txHash, logIndex). Same log can theoretically
  // appear twice if a wallet sends to itself; the dedupe key handles that.
  const seen = new Set<string>();
  const events: TransferEvent[] = [];
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    const { logs, direction } = result.value;
    for (const log of logs) {
      const key = log.transactionHash + ":" + log.logIndex;
      if (seen.has(key)) continue;
      seen.add(key);

      const tokenAddr = log.address as `0x${string}`;
      const tokenInfo = getTokenByAddress(tokenAddr);
      if (!tokenInfo) continue; // shouldn't happen since we filtered, but be safe

      // topics: [Transfer, fromTopic, toTopic]; data is the uint256 amount.
      const fromAddr = ("0x" + log.topics[1].slice(26)) as `0x${string}`;
      const toAddr = ("0x" + log.topics[2].slice(26)) as `0x${string}`;
      const counterparty = direction === "in" ? fromAddr : toAddr;
      const amountRaw = BigInt(log.data);
      const formatted = formatUnits(amountRaw, tokenInfo.decimals);
      const formattedNum = parseFloat(formatted);

      events.push({
        blockNumber: parseInt(log.blockNumber, 16),
        txHash: log.transactionHash as `0x${string}`,
        logIndex: parseInt(log.logIndex, 16),
        timestamp: null,
        direction,
        tokenSymbol: tokenInfo.symbol,
        tokenAddress: tokenAddr,
        amount:
          formattedNum < 0.001 && formattedNum > 0
            ? formattedNum.toExponential(2)
            : formattedNum.toFixed(formattedNum < 1 ? 6 : 4),
        amountRaw: amountRaw.toString(),
        counterparty,
      });
    }
  }

  // Sort newest first, then trim to limit.
  events.sort((a, b) => {
    if (b.blockNumber !== a.blockNumber) return b.blockNumber - a.blockNumber;
    return b.logIndex - a.logIndex;
  });
  const trimmed = events.slice(0, limit);

  // Fetch timestamps only for blocks we're actually showing.
  if (trimmed.length > 0) {
    const uniqueBlocks = Array.from(
      new Set(trimmed.map((e) => e.blockNumber))
    );
    const timestamps = await fetchBlockTimestamps(uniqueBlocks);
    for (const e of trimmed) {
      const ts = timestamps.get(e.blockNumber);
      if (ts !== undefined) e.timestamp = ts;
    }
  }

  return trimmed;
}

// Reference NATIVE_MON so the import isn't dead — keeps a reminder for the
// future native-MON tracking via debug_traceTransaction or an indexer.
void NATIVE_MON;
