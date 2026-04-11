import { formatUnits, getAddress } from "viem";
import { monadClient } from "@/lib/client";
import { ERC20_ABI } from "@/lib/abis";
import { TOKENS, NATIVE_MON, type TokenInfo } from "@/config/tokens";

// ─── Token Balance Types ───

export interface TokenBalance {
  token: TokenInfo;
  balance: bigint;
  formatted: string;
  valueUsd: number;
  priceUsd: number;
  change24h: number;
}

// ─── Fetch native MON balance ───
async function getNativeBalance(address: `0x${string}`): Promise<bigint> {
  return monadClient.getBalance({ address: getAddress(address) });
}

// ─── Batch-fetch all ERC-20 balances via multicall ───
async function getErc20Balances(
  walletAddress: `0x${string}`
): Promise<Map<string, bigint>> {
  const tokenEntries = Object.entries(TOKENS);

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

// ─── Fetch token prices from DefiLlama ───
export async function fetchTokenPrices(): Promise<Map<string, number>> {
  const prices = new Map<string, number>();

  try {
    // Fetch MON price via CoinGecko ID
    const monRes = await fetch(
      "https://coins.llama.fi/prices/current/coingecko:monad",
      { next: { revalidate: 120 } } // cache 2 min
    );
    const monData = await monRes.json();
    const monPrice = monData.coins?.["coingecko:monad"]?.price || 0;
    prices.set("MON", monPrice);
    prices.set("WMON", monPrice);

    // Fetch ERC-20 prices
    const addresses = Object.values(TOKENS)
      .map((t) => `monad:${t.address}`)
      .join(",");

    const res = await fetch(
      `https://coins.llama.fi/prices/current/${addresses}`,
      { next: { revalidate: 120 } }
    );
    const data = await res.json();

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
    if (!prices.has("USDT")) prices.set("USDT", 1.0);
    if (!prices.has("AUSD")) prices.set("AUSD", 1.0);

    // LST prices ≈ MON price (they accrue value slightly above 1:1)
    if (!prices.has("aprMON")) prices.set("aprMON", monPrice * 1.018);
    if (!prices.has("shMON")) prices.set("shMON", monPrice * 1.012);
  } catch (err) {
    console.error("Failed to fetch token prices:", err);
  }

  return prices;
}

// ─── Main: Get full token portfolio ───
export async function fetchTokenBalances(
  walletAddress: `0x${string}`
): Promise<TokenBalance[]> {
  const [nativeBalance, erc20Balances, prices] = await Promise.all([
    getNativeBalance(walletAddress).catch(() => 0n),
    getErc20Balances(walletAddress).catch(() => new Map<string, bigint>()),
    fetchTokenPrices(),
  ]);

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
      change24h: 0, // TODO: fetch from price API
    });
  }

  // Add ERC-20 tokens
  for (const [symbol, balance] of erc20Balances) {
    const token = TOKENS[symbol];
    if (!token) continue;

    const formatted = formatUnits(balance, token.decimals);
    const price = prices.get(symbol) || 0;

    balances.push({
      token,
      balance,
      formatted,
      priceUsd: price,
      valueUsd: parseFloat(formatted) * price,
      change24h: 0, // TODO: fetch from price API
    });
  }

  // Sort by USD value descending
  balances.sort((a, b) => b.valueUsd - a.valueUsd);

  return balances;
}
