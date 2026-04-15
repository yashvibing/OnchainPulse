"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { TOKENS, NATIVE_MON, type TokenInfo } from "@/config/tokens";
import { fetchSwapQuotes, buildSwapTx, type SwapQuote } from "@/services/swap";
import { formatNumber } from "@/lib/format";

const NATIVE_ADDR = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Swappable tokens: native MON + all ERC-20s
const SWAP_TOKENS: TokenInfo[] = [
  { ...NATIVE_MON, address: NATIVE_ADDR as `0x${string}` },
  ...Object.values(TOKENS),
];

function TokenSelector({
  selected,
  onChange,
  exclude,
}: {
  selected: TokenInfo;
  onChange: (t: TokenInfo) => void;
  exclude?: string;
}) {
  const [open, setOpen] = useState(false);
  const filtered = SWAP_TOKENS.filter((t) => t.address !== exclude);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-hover)]"
      >
        <span
          className="inline-block h-5 w-5 rounded-full text-[8px] font-bold text-white flex items-center justify-center"
          style={{ background: selected.logoColor || "#5A5A74" }}
        >
          {selected.symbol.slice(0, 2)}
        </span>
        {selected.symbol}
        <span className="text-[var(--color-text-dim)]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-48 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-xl">
          {filtered.map((t) => (
            <button
              key={t.address}
              onClick={() => { onChange(t); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-card-hover)]"
            >
              <span
                className="inline-block h-4 w-4 rounded-full text-[7px] font-bold text-white flex items-center justify-center"
                style={{ background: t.logoColor || "#5A5A74" }}
              >
                {t.symbol.slice(0, 2)}
              </span>
              {t.symbol}
              <span className="ml-auto text-[11px] text-[var(--color-text-dim)]">{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuoteCard({
  quote,
  isBest,
  onSwap,
  isSwapping,
}: {
  quote: SwapQuote;
  isBest: boolean;
  onSwap: () => void;
  isSwapping: boolean;
}) {
  return (
    <div
      className={`animate-fade-up flex items-center justify-between rounded-[var(--radius-lg)] border px-4 py-3 ${
        isBest
          ? "border-[var(--color-accent-primary)] bg-[rgba(0,232,123,0.06)]"
          : "border-[var(--color-border)] bg-[var(--color-bg-card)]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: quote.aggregatorColor }}
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
              {quote.aggregator}
            </span>
            {isBest && (
              <span className="rounded-full bg-[rgba(20,184,166,0.1)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--color-positive)]">
                Best
              </span>
            )}
          </div>
          <div className="text-[11px] text-[var(--color-text-dim)]">
            Gas: ~{parseInt(quote.gasEstimate).toLocaleString()}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="font-mono text-[15px] font-semibold text-[var(--color-text-primary)]">
            {parseFloat(quote.amountOutFormatted) >= 1000
              ? formatNumber(parseFloat(quote.amountOutFormatted), 2)
              : parseFloat(quote.amountOutFormatted).toFixed(6)}
          </div>
        </div>
        <button
          onClick={onSwap}
          disabled={isSwapping}
          className={`rounded-[var(--radius-md)] px-4 py-2 text-[12px] font-semibold text-white transition-opacity disabled:opacity-50 ${
            isBest ? "btn-primary" : "bg-[var(--color-bg-card-elevated)]"
          }`}
        >
          {isSwapping ? "Swapping..." : "Swap"}
        </button>
      </div>
    </div>
  );
}

export function SwapPanel() {
  const { address: walletAddress, isConnected } = useAccount();
  const { sendTransaction, data: txHash, isPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const [tokenIn, setTokenIn] = useState<TokenInfo>(SWAP_TOKENS[0]); // MON
  const [tokenOut, setTokenOut] = useState<TokenInfo>(SWAP_TOKENS.find((t) => t.symbol === "USDC")!);
  const [amountIn, setAmountIn] = useState("");
  const [quotes, setQuotes] = useState<SwapQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [swappingIdx, setSwappingIdx] = useState<number | null>(null);
  const [slippage, setSlippage] = useState(1); // 1%
  const [error, setError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState(false);

  // Fetch quotes when input changes (debounced)
  const fetchQuotes = useCallback(async () => {
    if (!amountIn || parseFloat(amountIn) <= 0) {
      setQuotes([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results = await fetchSwapQuotes(
        tokenIn.address,
        tokenOut.address,
        amountIn,
        tokenIn.decimals,
        tokenOut.decimals
      );
      setQuotes(results);
      if (results.length === 0) {
        setError("No routes found. Try a different pair or amount.");
      }
    } catch {
      setError("Failed to fetch quotes.");
      setQuotes([]);
    }
    setLoading(false);
  }, [amountIn, tokenIn, tokenOut]);

  useEffect(() => {
    const timer = setTimeout(fetchQuotes, 500);
    return () => clearTimeout(timer);
  }, [fetchQuotes]);

  // Handle tx success
  useEffect(() => {
    if (isSuccess) {
      setTxSuccess(true);
      setSwappingIdx(null);
      setTimeout(() => setTxSuccess(false), 5000);
    }
  }, [isSuccess]);

  async function handleSwap(quote: SwapQuote, idx: number) {
    if (!isConnected || !walletAddress) {
      setError("Connect your wallet first.");
      return;
    }

    setSwappingIdx(idx);
    setError(null);

    const txData = await buildSwapTx(
      quote,
      walletAddress,
      slippage,
      tokenIn.address,
      tokenOut.address,
      amountIn,
      tokenIn.decimals
    );

    if (!txData) {
      setError(`Failed to build ${quote.aggregator} transaction. Try another aggregator.`);
      setSwappingIdx(null);
      return;
    }

    try {
      sendTransaction({
        to: txData.to,
        data: txData.data,
        value: txData.value,
      });
    } catch {
      setError("Transaction rejected.");
      setSwappingIdx(null);
    }
  }

  function handleFlip() {
    const tmp = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(tmp);
    setQuotes([]);
  }

  return (
    <div className="mx-auto max-w-[520px]">
      {/* Input card */}
      <div className="card-elevated p-5">
        {/* From */}
        <div className="mb-1 text-[11px] text-[var(--color-text-dim)]">You pay</div>
        <div className="mb-3 flex items-center gap-3">
          <input
            type="number"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            placeholder="0.0"
            className="flex-1 bg-transparent text-[24px] font-semibold text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-dim)]"
          />
          <TokenSelector
            selected={tokenIn}
            onChange={(t) => { setTokenIn(t); setQuotes([]); }}
            exclude={tokenOut.address}
          />
        </div>

        {/* Flip button */}
        <div className="flex justify-center py-1">
          <button
            onClick={handleFlip}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-2 text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-secondary)]"
          >
            ↕
          </button>
        </div>

        {/* To */}
        <div className="mb-1 text-[11px] text-[var(--color-text-dim)]">You receive</div>
        <div className="flex items-center gap-3">
          <div className="flex-1 text-[24px] font-semibold text-[var(--color-text-muted)]">
            {loading
              ? "..."
              : quotes[0]
                ? parseFloat(quotes[0].amountOutFormatted) >= 1000
                  ? formatNumber(parseFloat(quotes[0].amountOutFormatted), 2)
                  : parseFloat(quotes[0].amountOutFormatted).toFixed(6)
                : "0.0"}
          </div>
          <TokenSelector
            selected={tokenOut}
            onChange={(t) => { setTokenOut(t); setQuotes([]); }}
            exclude={tokenIn.address}
          />
        </div>

        {/* Slippage */}
        <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
          <span className="text-[11px] text-[var(--color-text-dim)]">Slippage</span>
          {[0.5, 1, 2].map((s) => (
            <button
              key={s}
              onClick={() => setSlippage(s)}
              className={`rounded-[var(--radius-sm)] px-2 py-0.5 text-[11px] font-medium transition-colors ${
                slippage === s
                  ? "bg-[var(--color-accent-primary)] text-white"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {s}%
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 rounded-[var(--radius-md)] bg-[rgba(239,68,68,0.08)] px-4 py-2 text-[12px] text-[var(--color-negative)]">
          {error}
        </div>
      )}

      {/* Success */}
      {txSuccess && txHash && (
        <div className="mt-3 rounded-[var(--radius-md)] bg-[rgba(20,184,166,0.08)] px-4 py-2 text-[12px] text-[var(--color-positive)]">
          Swap successful!{" "}
          <a
            href={`https://monadvision.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View transaction
          </a>
        </div>
      )}

      {/* Quotes */}
      {quotes.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] text-[var(--color-text-dim)]">
              {quotes.length} route{quotes.length !== 1 ? "s" : ""} found
            </span>
            <span className="text-[11px] text-[var(--color-text-dim)]">
              Best: {quotes[0].aggregator}
            </span>
          </div>
          {quotes.map((q, i) => (
            <QuoteCard
              key={q.aggregator}
              quote={q}
              isBest={i === 0}
              onSwap={() => handleSwap(q, i)}
              isSwapping={(swappingIdx === i && isPending) || (swappingIdx === i && isConfirming)}
            />
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-4 text-center text-[13px] text-[var(--color-text-muted)]">
          Fetching rates from 4 aggregators...
        </div>
      )}

      {/* Not connected */}
      {!isConnected && amountIn && parseFloat(amountIn) > 0 && quotes.length > 0 && (
        <div className="mt-3 text-center text-[12px] text-[var(--color-warning)]">
          Connect wallet to swap
        </div>
      )}
    </div>
  );
}
