import { formatUnits, getAddress, parseUnits } from "viem";
import { monadClient } from "@/lib/client";
import { ERC20_ABI } from "@/lib/abis";
import { TOKENS, NATIVE_MON, type TokenInfo } from "@/config/tokens";
import { fetchJsonWithRetry } from "@/lib/sourceFetch";
import { getErrorMessage, logServerEvent } from "@/lib/serverLog";

const TOKEN_LIST_URL =
  "https://raw.githubusercontent.com/monad-crypto/token-list/main/tokenlist-mainnet.json";
const BLOCKVISION_ACCOUNT_TOKENS_URL =
  "https://api.blockvision.org/v2/monad/account/tokens";

interface TokenListItem {
  chainId?: number;
  address?: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  logoURI?: string;
}

type BlockVisionTokenRecord = Record<string, unknown>;

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
const STABLECOIN_SYMBOLS = new Set(["USDC", "USDT0", "USDT", "AUSD", "USD1", "VUSD"]);
const NATIVE_SENTINEL = "0x0000000000000000000000000000000000000000";

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

function getNestedString(record: BlockVisionTokenRecord, paths: string[][]) {
  for (const path of paths) {
    let value: unknown = record;
    for (const part of path) {
      value = value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined;
    }
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function getNestedNumber(record: BlockVisionTokenRecord, paths: string[][]) {
  const raw = getNestedString(record, paths);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function getBlockVisionItems(payload: unknown): BlockVisionTokenRecord[] {
  const candidates = [
    payload,
    (payload as Record<string, unknown> | undefined)?.result,
    (payload as Record<string, unknown> | undefined)?.data,
    ((payload as Record<string, unknown> | undefined)?.result as Record<string, unknown> | undefined)?.data,
    ((payload as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined)?.data,
    ((payload as Record<string, unknown> | undefined)?.result as Record<string, unknown> | undefined)?.tokens,
    ((payload as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined)?.tokens,
    ((payload as Record<string, unknown> | undefined)?.result as Record<string, unknown> | undefined)?.items,
    ((payload as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined)?.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as BlockVisionTokenRecord[];
  }

  return [];
}

function tokenCategoryFor(symbol: string): TokenInfo["category"] {
  if (LST_SYMBOLS.has(symbol)) return "lst";
  if (STABLECOIN_SYMBOLS.has(symbol.toUpperCase())) return "stablecoin";
  if (symbol.toUpperCase().startsWith("W")) return "wrapped";
  return "defi";
}

function parseTokenBalance(
  record: BlockVisionTokenRecord,
  decimals: number
): bigint {
  const rawBalance = getNestedString(record, [
    ["balanceRaw"],
    ["rawBalance"],
    ["raw_balance"],
    ["tokenBalanceRaw"],
    ["tokenBalance", "raw"],
    ["balance", "raw"],
    ["amountRaw"],
  ]);

  if (/^\d+$/u.test(rawBalance)) return BigInt(rawBalance);

  const formattedBalance = getNestedString(record, [
    ["balance"],
    ["amount"],
    ["quantity"],
    ["tokenBalance"],
    ["formattedBalance"],
    ["balanceFormatted"],
  ]).replace(/,/g, "");

  if (/^\d+(\.\d+)?$/u.test(formattedBalance)) {
    return parseUnits(formattedBalance, decimals);
  }

  return 0n;
}

function tokenFromBlockVisionRecord(
  record: BlockVisionTokenRecord,
  allTokens: Record<string, TokenInfo>
): TokenInfo | null {
  const symbol = getNestedString(record, [
    ["symbol"],
    ["tokenSymbol"],
    ["token", "symbol"],
    ["contract", "symbol"],
  ]);
  const address = getNestedString(record, [
    ["address"],
    ["tokenAddress"],
    ["token_address"],
    ["contractAddress"],
    ["contract_address"],
    ["token", "address"],
    ["contract", "address"],
  ]);
  const normalizedAddress = address && /^0x[a-fA-F0-9]{40}$/u.test(address)
    ? getAddress(address)
    : "";
  const upperSymbol = symbol.toUpperCase();

  if (
    upperSymbol === "MON" ||
    !normalizedAddress ||
    normalizedAddress.toLowerCase() === NATIVE_SENTINEL
  ) {
    return NATIVE_MON;
  }

  const knownByAddress = Object.values(allTokens).find(
    (token) => token.address.toLowerCase() === normalizedAddress.toLowerCase()
  );
  if (knownByAddress) return knownByAddress;

  const knownBySymbol = allTokens[symbol] || allTokens[upperSymbol];
  if (knownBySymbol) return knownBySymbol;

  const decimals = getNestedNumber(record, [
    ["decimals"],
    ["tokenDecimals"],
    ["token", "decimals"],
    ["contract", "decimals"],
  ]);
  const name = getNestedString(record, [
    ["name"],
    ["tokenName"],
    ["token", "name"],
    ["contract", "name"],
  ]);
  if (!symbol || typeof decimals !== "number") return null;

  return {
    address: normalizedAddress as `0x${string}`,
    symbol,
    name: name || symbol,
    decimals,
    category: tokenCategoryFor(symbol),
    logoURI: getNestedString(record, [["logoURI"], ["logo"], ["icon"], ["token", "logoURI"]]) || undefined,
  };
}

async function getBlockVisionTokenBalances(
  walletAddress: `0x${string}`,
  allTokens: Record<string, TokenInfo>
): Promise<Map<string, { token: TokenInfo; balance: bigint }>> {
  if (!process.env.BLOCKVISION_API_KEY) return new Map();

  try {
    const payload = await fetchJsonWithRetry<unknown>(
      `${BLOCKVISION_ACCOUNT_TOKENS_URL}?address=${encodeURIComponent(walletAddress)}`,
      {
        headers: { "x-api-key": process.env.BLOCKVISION_API_KEY },
        retries: 1,
        timeoutMs: 8_000,
        sourceName: "blockvision-account-tokens",
      }
    );
    const records = getBlockVisionItems(payload);
    const balances = new Map<string, { token: TokenInfo; balance: bigint }>();

    for (const record of records) {
      const token = tokenFromBlockVisionRecord(record, allTokens);
      if (!token) continue;
      const balance = parseTokenBalance(record, token.decimals);
      if (balance <= 0n) continue;
      balances.set(token.symbol, { token, balance });
    }

    if (balances.size > 0) {
      logServerEvent("info", "indexer.token_balances_used", {
        source: "blockvision",
        tokenCount: balances.size,
      });
    }

    return balances;
  } catch (error) {
    logServerEvent("warn", "indexer.token_balances_failed", {
      source: "blockvision",
      error: getErrorMessage(error),
    });
    return new Map();
  }
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
  const [allTokens, prices, changes24h] = await Promise.all([
    getAllTokens(),
    fetchTokenPrices(),
    fetchTokenChanges24h().catch(() => new Map<string, number>()),
  ]);

  const indexedBalances = await getBlockVisionTokenBalances(walletAddress, allTokens);
  const nativeFromIndexer = indexedBalances.get("MON")?.balance || 0n;
  const nativeBalance = nativeFromIndexer ||
    (await getNativeBalance(walletAddress).catch(() => 0n));
  const erc20Balances = indexedBalances.size > 0
    ? indexedBalances
    : await getErc20Balances(walletAddress, allTokens).then((balances) => {
        const mapped = new Map<string, { token: TokenInfo; balance: bigint }>();
        for (const [symbol, balance] of balances) {
          const token = allTokens[symbol];
          if (token) mapped.set(symbol, { token, balance });
        }
        return mapped;
      }).catch(() => new Map<string, { token: TokenInfo; balance: bigint }>());

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
  for (const [symbol, { token, balance }] of erc20Balances) {
    if (token.category === "native") continue;

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
