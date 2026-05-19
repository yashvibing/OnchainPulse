import { formatUnits, getAddress } from "viem";
import { monadClient } from "@/lib/client";
import { ERC20_ABI } from "@/lib/abis";
import { TOKENS, NATIVE_MON, type TokenInfo } from "@/config/tokens";
import { fetchJsonWithRetry } from "@/lib/sourceFetch";

const TOKEN_LIST_URL =
  "https://raw.githubusercontent.com/monad-crypto/token-list/main/tokenlist-mainnet.json";

interface TokenListItem {
  chainId?: number;
  address?: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  logoURI?: string;
}

// ─── Token Balance Types ───

export interface TokenBalance {
  token: TokenInfo;
  balance: bigint;
  formatted: string;
  valueUsd: number;
  priceUsd: number;
  change24h: number | null;
}

// ─── Dynamic token list (fetched once, cached in memory) ───

let cachedExtendedTokens: TokenInfo[] | null = null;

// LST symbols that must keep category:"lst" for double-count protection
const LST_SYMBOLS = new Set(["aprMON", "shMON", "sMON", "gMON"]);

async function getExtendedTokenList(): Promise<TokenInfo[]> {
  if (cachedExtendedTokens) return cachedExtendedTokens;

  try {
    const data = await fetchJsonWithRetry<{ tokens?: TokenListItem[] }>(
      TOKEN_LIST_URL,
      { next: { revalidate: 3600 }, retries: 1, timeoutMs: 8_000 }
    );
    const tokens: TokenInfo[] = [];

    for (const t of data.tokens || []) {
      if (
        t.chainId !== 143 ||
        !t.address ||
        !t.symbol ||
        !t.name ||
        typeof t.decimals !== "number"
      ) {
        continue;
      }
      const address = t.address;
      const symbol = t.symbol;
      const name = t.name;
      const decimals = t.decimals;
      // Skip tokens we already have in our curated list
      const existing = Object.values(TOKENS).find(
        (k) => k.address.toLowerCase() === address.toLowerCase()
      );
      if (existing) {
        // Enrich existing with logoURI if we don't have one
        if (!existing.logoURI && t.logoURI) existing.logoURI = t.logoURI;
        continue;
      }

      tokens.push({
        address: address as `0x${string}`,
        symbol,
        name,
        decimals,
        category: LST_SYMBOLS.has(symbol) ? "lst" : "defi",
        logoURI: t.logoURI,
      });
    }

    cachedExtendedTokens = tokens;
    return tokens;
  } catch {
    return [];
  }
}

// Build a combined token list: curated + dynamic
async function getAllTokens(): Promise<Record<string, TokenInfo>> {
  const extended = await getExtendedTokenList();
  const all: Record<string, TokenInfo> = { ...TOKENS };
  for (const t of extended) {
    if (!all[t.symbol]) all[t.symbol] = t;
  }
  return all;
}

// ─── Fetch native MON balance ───
async function getNativeBalance(address: `0x${string}`): Promise<bigint> {
  return monadClient.getBalance({ address: getAddress(address) });
}

// ─── Batch-fetch all ERC-20 balances via multicall ───
async function getErc20Balances(
  walletAddress: `0x${string}`,
  tokens?: Record<string, TokenInfo>
): Promise<Map<string, bigint>> {
  const tokenEntries = Object.entries(tokens || TOKENS);

  const normalizedWallet = getAddress(walletAddress);
  const contracts = tokenEntries.map(([, token]) => ({
    address: getAddress(token.address),
    abi: ERC20_ABI,
    functionName: "balanceOf" as const,
    args: [normalizedWallet] as const,
  }));

  const results = await monadClient.multicall({ contracts });

  const balances = new Map<string, bigint>();
  tokenEntries.forEach(([symbol], i) => {
    const result = results[i];
    if (result.status === "success" && result.result > 0n) {
      balances.set(symbol, result.result as bigint);
    }
  });

  return balances;
}

// ─── Fetch 24h price change percentages from DefiLlama ───
export async function fetchTokenChanges24h(): Promise<Map<string, number>> {
  const changes = new Map<string, number>();
  try {
    const coinKeys = [
      "coingecko:monad",
      ...Object.values(TOKENS).map((t) => `monad:${t.address}`),
    ].join(",");
    const data = await fetchJsonWithRetry<{ coins?: Record<string, number> }>(
      `https://coins.llama.fi/percentage/${coinKeys}?lookForward=false&period=1d`,
      { next: { revalidate: 120 }, retries: 1, timeoutMs: 8_000 }
    );
    // DefiLlama returns coins[key] as a flat number (the % change), e.g.
    //   {"coins":{"monad:0x...":1.7559,"coingecko:monad":1.7412}}
    for (const [key, val] of Object.entries(data.coins || {})) {
      if (typeof val !== "number") continue;
      if (key === "coingecko:monad") {
        changes.set("MON", val);
        changes.set("WMON", val);
        continue;
      }
      const addr = key.replace("monad:", "").toLowerCase();
      const token = Object.values(TOKENS).find(
        (t) => t.address.toLowerCase() === addr
      );
      if (token) changes.set(token.symbol, val);
    }
  } catch (err) {
    console.warn("Token 24h changes unavailable; continuing without them.", err);
  }
  return changes;
}

// ─── Fetch token prices from DefiLlama ───
export async function fetchTokenPrices(): Promise<Map<string, number>> {
  const prices = new Map<string, number>();

  try {
    // Fetch MON price via CoinGecko ID
    const monData = await fetchJsonWithRetry<{ coins?: Record<string, { price: number }> }>(
      "https://coins.llama.fi/prices/current/coingecko:monad",
      { next: { revalidate: 120 }, retries: 1, timeoutMs: 8_000 } // cache 2 min
    );
    const monPrice = monData.coins?.["coingecko:monad"]?.price || 0;
    prices.set("MON", monPrice);
    prices.set("WMON", monPrice);

    // Fetch ERC-20 prices
    const addresses = Object.values(TOKENS)
      .map((t) => `monad:${t.address}`)
      .join(",");

    const data = await fetchJsonWithRetry<{ coins?: Record<string, { price: number }> }>(
      `https://coins.llama.fi/prices/current/${addresses}`,
      { next: { revalidate: 120 }, retries: 1, timeoutMs: 8_000 }
    );

    for (const [key, val] of Object.entries(data.coins || {})) {
      const addr = key.replace("monad:", "").toLowerCase();
      const token = Object.values(TOKENS).find(
        (t) => t.address.toLowerCase() === addr
      );
      if (token) {
        prices.set(token.symbol, (val as { price: number }).price);
      }
    }

    // Fallback prices for stablecoins
    if (!prices.has("USDC")) prices.set("USDC", 1.0);
    if (!prices.has("USDT0")) prices.set("USDT0", 1.0);
    if (!prices.has("AUSD")) prices.set("AUSD", 1.0);
    if (!prices.has("USD1")) prices.set("USD1", 1.0);

    // LST prices ≈ MON price (they accrue value slightly above 1:1)
    if (!prices.has("aprMON")) prices.set("aprMON", monPrice * 1.018);
    if (!prices.has("shMON")) prices.set("shMON", monPrice * 1.012);
    if (!prices.has("sMON")) prices.set("sMON", monPrice * 1.054);
    if (!prices.has("gMON")) prices.set("gMON", monPrice * 1.048);
  } catch (err) {
    console.warn("Token prices unavailable; using fallback pricing where possible.", err);
  }

  return prices;
}

// ─── Main: Get full token portfolio ───
export async function fetchTokenBalances(
  walletAddress: `0x${string}`
): Promise<TokenBalance[]> {
  const [nativeBalance, allTokens, prices, changes24h] = await Promise.all([
    getNativeBalance(walletAddress).catch(() => 0n),
    getAllTokens(),
    fetchTokenPrices(),
    fetchTokenChanges24h().catch(() => new Map<string, number>()),
  ]);

  const erc20Balances = await getErc20Balances(walletAddress, allTokens).catch(
    () => new Map<string, bigint>()
  );

  const balances: TokenBalance[] = [];

  // Add native MON
  if (nativeBalance > 0n) {
    const formatted = formatUnits(nativeBalance, 18);
    const price = prices.get("MON") || 0;
    balances.push({
      token: NATIVE_MON,
      balance: nativeBalance,
      formatted,
      priceUsd: price,
      valueUsd: parseFloat(formatted) * price,
      change24h: changes24h.has("MON") ? changes24h.get("MON")! : null,
    });
  }

  // Add ERC-20 tokens
  for (const [symbol, balance] of erc20Balances) {
    const token = allTokens[symbol];
    if (!token) continue;

    const formatted = formatUnits(balance, token.decimals);
    const price = prices.get(symbol) || 0;

    balances.push({
      token,
      balance,
      formatted,
      priceUsd: price,
      valueUsd: parseFloat(formatted) * price,
      change24h: changes24h.has(symbol) ? changes24h.get(symbol)! : null,
    });
  }

  // Sort by USD value descending
  balances.sort((a, b) => b.valueUsd - a.valueUsd);

  return balances;
}
