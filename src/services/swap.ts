import { formatUnits, parseUnits } from "viem";

// ─── Types ───

export interface SwapQuote {
  aggregator: string;
  aggregatorColor: string;
  amountOut: string; // raw bigint string
  amountOutFormatted: string;
  amountOutUsd: number;
  gasEstimate: string;
  routerAddress: `0x${string}`;
  // For building the tx
  buildParams: Record<string, unknown>;
}

export interface SwapTxData {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
}

// Native MON placeholder used by some aggregators
const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// ─── KyberSwap ───
// Amount in wei. Returns routeSummary for building tx later.

async function quoteKyber(
  tokenIn: string,
  tokenOut: string,
  amountInWei: string,
  decimalsOut: number
): Promise<SwapQuote | null> {
  try {
    const params = new URLSearchParams({
      tokenIn: tokenIn === NATIVE ? NATIVE : tokenIn,
      tokenOut: tokenOut === NATIVE ? NATIVE : tokenOut,
      amountIn: amountInWei,
    });
    const res = await fetch(
      `https://aggregator-api.kyberswap.com/monad/api/v1/routes?${params}`,
      { headers: { "X-Client-Id": "onchain-pulse" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const summary = data?.data?.routeSummary;
    if (!summary) return null;

    return {
      aggregator: "KyberSwap",
      aggregatorColor: "#31CB9E",
      amountOut: summary.amountOut,
      amountOutFormatted: formatUnits(BigInt(summary.amountOut), decimalsOut),
      amountOutUsd: parseFloat(summary.amountOutUsd || "0"),
      gasEstimate: summary.gas || "0",
      routerAddress: data.data.routerAddress as `0x${string}`,
      buildParams: { routeSummary: summary, source: "kyber" },
    };
  } catch {
    return null;
  }
}

async function buildKyberTx(
  params: Record<string, unknown>,
  sender: string,
  slippage: number
): Promise<SwapTxData | null> {
  try {
    const res = await fetch(
      "https://aggregator-api.kyberswap.com/monad/api/v1/route/build",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Id": "onchain-pulse",
        },
        body: JSON.stringify({
          routeSummary: params.routeSummary,
          sender,
          recipient: sender,
          slippageTolerance: slippage * 100, // basis points
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      to: data.data.routerAddress as `0x${string}`,
      data: data.data.data as `0x${string}`,
      value: BigInt(data.data.transactionValue || "0"),
    };
  } catch {
    return null;
  }
}

// ─── Monorail ───
// Amount in human-readable format.

async function quoteMonorail(
  tokenIn: string,
  tokenOut: string,
  amountHuman: string,
  decimalsOut: number
): Promise<SwapQuote | null> {
  try {
    const params = new URLSearchParams({
      source: "onchain-pulse",
      from: tokenIn === NATIVE ? "0x0000000000000000000000000000000000000000" : tokenIn,
      to: tokenOut === NATIVE ? "0x0000000000000000000000000000000000000000" : tokenOut,
      amount: amountHuman,
    });
    const res = await fetch(
      `https://pathfinder.monorail.xyz/v4/quote?${params}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.output) return null;

    return {
      aggregator: "Monorail",
      aggregatorColor: "#FF6B35",
      amountOut: data.output,
      amountOutFormatted: data.output_formatted || formatUnits(BigInt(data.output), decimalsOut),
      amountOutUsd: 0, // Monorail doesn't return USD values
      gasEstimate: data.gas_estimate || "0",
      routerAddress: "0xa68a7f0601effdc65c64d9c47ca1b18d96b4352c" as `0x${string}`,
      buildParams: { quoteResponse: data, source: "monorail" },
    };
  } catch {
    return null;
  }
}

async function buildMonorailTx(
  params: Record<string, unknown>,
  sender: string,
  slippage: number,
  tokenIn: string,
  tokenOut: string,
  amountHuman: string
): Promise<SwapTxData | null> {
  try {
    const qp = new URLSearchParams({
      source: "onchain-pulse",
      from: tokenIn === NATIVE ? "0x0000000000000000000000000000000000000000" : tokenIn,
      to: tokenOut === NATIVE ? "0x0000000000000000000000000000000000000000" : tokenOut,
      amount: amountHuman,
      sender,
      max_slippage: String(Math.round(slippage * 100)), // basis points
    });
    const res = await fetch(`https://pathfinder.monorail.xyz/v4/quote?${qp}`);
    if (!res.ok) return null;
    const data = await res.json();
    const tx = data.transaction;
    if (!tx || !tx.data || tx.data.includes("No sender")) return null;

    return {
      to: tx.to as `0x${string}`,
      data: tx.data as `0x${string}`,
      value: BigInt(tx.value || "0"),
    };
  } catch {
    return null;
  }
}

// ─── OpenOcean ───
// Amount in human-readable format.

async function quoteOpenOcean(
  tokenIn: string,
  tokenOut: string,
  amountHuman: string,
  decimalsOut: number
): Promise<SwapQuote | null> {
  try {
    const params = new URLSearchParams({
      inTokenAddress: tokenIn === NATIVE ? NATIVE : tokenIn,
      outTokenAddress: tokenOut === NATIVE ? NATIVE : tokenOut,
      amount: amountHuman,
      slippage: "1",
      gasPrice: "50000000000", // 50 gwei default
    });
    const res = await fetch(
      `https://open-api.openocean.finance/v4/monad/quote?${params}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 200 || !data.data) return null;

    return {
      aggregator: "OpenOcean",
      aggregatorColor: "#1B8AEF",
      amountOut: data.data.outAmount,
      amountOutFormatted: formatUnits(BigInt(data.data.outAmount), decimalsOut),
      amountOutUsd: 0,
      gasEstimate: String(data.data.estimatedGas || "0"),
      routerAddress: "0x6352a56caadC4F1E25CD6c75970Fa768A3304e64" as `0x${string}`,
      buildParams: { quoteData: data.data, source: "openocean" },
    };
  } catch {
    return null;
  }
}

async function buildOpenOceanTx(
  _params: Record<string, unknown>,
  sender: string,
  slippage: number,
  tokenIn: string,
  tokenOut: string,
  amountHuman: string
): Promise<SwapTxData | null> {
  try {
    const params = new URLSearchParams({
      inTokenAddress: tokenIn === NATIVE ? NATIVE : tokenIn,
      outTokenAddress: tokenOut === NATIVE ? NATIVE : tokenOut,
      amount: amountHuman,
      slippage: String(slippage),
      gasPrice: "50000000000",
      account: sender,
    });
    const res = await fetch(
      `https://open-api.openocean.finance/v4/monad/swap?${params}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 200 || !data.data) return null;

    return {
      to: data.data.to as `0x${string}`,
      data: data.data.data as `0x${string}`,
      value: BigInt(data.data.value || "0"),
    };
  } catch {
    return null;
  }
}

// ─── Fibrous ───
// Amount in wei.

async function quoteFibrous(
  tokenIn: string,
  tokenOut: string,
  amountInWei: string,
  decimalsOut: number
): Promise<SwapQuote | null> {
  try {
    const params = new URLSearchParams({
      amount: amountInWei,
      tokenInAddress: tokenIn === NATIVE ? "0x0000000000000000000000000000000000000000" : tokenIn,
      tokenOutAddress: tokenOut === NATIVE ? "0x0000000000000000000000000000000000000000" : tokenOut,
    });
    const res = await fetch(
      `https://api.fibrous.finance/monad/route?${params}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !data.outputAmount) return null;

    return {
      aggregator: "Fibrous",
      aggregatorColor: "#8B5CF6",
      amountOut: data.outputAmount,
      amountOutFormatted: formatUnits(BigInt(data.outputAmount), decimalsOut),
      amountOutUsd: 0,
      gasEstimate: String(data.estimatedGasUsed || "0"),
      routerAddress: "0x274602a953847d807231d2370072F5f4E4594B44" as `0x${string}`,
      buildParams: { routeData: data, source: "fibrous" },
    };
  } catch {
    return null;
  }
}

async function buildFibrousTx(
  _params: Record<string, unknown>,
  sender: string,
  slippage: number,
  tokenIn: string,
  tokenOut: string,
  amountInWei: string
): Promise<SwapTxData | null> {
  try {
    const params = new URLSearchParams({
      amount: amountInWei,
      tokenInAddress: tokenIn === NATIVE ? "0x0000000000000000000000000000000000000000" : tokenIn,
      tokenOutAddress: tokenOut === NATIVE ? "0x0000000000000000000000000000000000000000" : tokenOut,
      slippage: String(slippage),
      destination: sender,
    });
    const res = await fetch(
      `https://api.fibrous.finance/monad/calldata?${params}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.calldata) return null;

    return {
      to: (data.router_address || "0x274602a953847d807231d2370072F5f4E4594B44") as `0x${string}`,
      data: data.calldata.swap_parameters?.data as `0x${string}` || "0x" as `0x${string}`,
      value: BigInt(data.calldata.swap_parameters?.value || "0"),
    };
  } catch {
    return null;
  }
}

// ─── Public API ───

export async function fetchSwapQuotes(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  decimalsIn: number,
  decimalsOut: number
): Promise<SwapQuote[]> {
  const amountInWei = parseUnits(amountIn, decimalsIn).toString();

  const results = await Promise.allSettled([
    quoteKyber(tokenIn, tokenOut, amountInWei, decimalsOut),
    quoteMonorail(tokenIn, tokenOut, amountIn, decimalsOut),
    quoteOpenOcean(tokenIn, tokenOut, amountIn, decimalsOut),
    quoteFibrous(tokenIn, tokenOut, amountInWei, decimalsOut),
  ]);

  const quotes: SwapQuote[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      quotes.push(r.value);
    }
  }

  // Sort by output amount descending (best rate first)
  quotes.sort((a, b) => {
    const aOut = BigInt(a.amountOut || "0");
    const bOut = BigInt(b.amountOut || "0");
    if (bOut > aOut) return 1;
    if (bOut < aOut) return -1;
    return 0;
  });

  return quotes;
}

export async function buildSwapTx(
  quote: SwapQuote,
  sender: string,
  slippage: number,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  decimalsIn: number
): Promise<SwapTxData | null> {
  const amountInWei = parseUnits(amountIn, decimalsIn).toString();
  const source = quote.buildParams.source as string;

  switch (source) {
    case "kyber":
      return buildKyberTx(quote.buildParams, sender, slippage);
    case "monorail":
      return buildMonorailTx(quote.buildParams, sender, slippage, tokenIn, tokenOut, amountIn);
    case "openocean":
      return buildOpenOceanTx(quote.buildParams, sender, slippage, tokenIn, tokenOut, amountIn);
    case "fibrous":
      return buildFibrousTx(quote.buildParams, sender, slippage, tokenIn, tokenOut, amountInWei);
    default:
      return null;
  }
}
