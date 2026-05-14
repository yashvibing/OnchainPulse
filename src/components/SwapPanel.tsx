"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { TOKENS, NATIVE_MON, type TokenInfo } from "@/config/tokens";
import { fetchSwapQuotes, buildSwapTx, type SwapQuote } from "@/services/swap";
import { formatNumber } from "@/lib/format";

const NATIVE_ADDR = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

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
        <div className="absolute right-0 top-full z-50 mt-1 max-h-60 w-48 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-xl">
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

export function SwapPanel() {
  const { address: walletAddress, isConnected } = useAccount();
  const { sendTransaction, data: txHash, isPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const [tokenIn, setTokenIn] = useState<TokenInfo>(SWAP_TOKENS[0]);
  const [tokenOut, setTokenOut] = useState<TokenInfo>(SWAP_TOKENS.find((t) => t.symbol === "USDC")!);
  const [amountIn, setAmountIn] = useState("");
  const [quotes, setQuotes] = useState<SwapQuote[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [slippage, setSlippage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState(false);

  const fetchQuotesDebounced = useCallback(async () => {
    if (!amountIn || parseFloat(amountIn) <= 0) { setQuotes([]); return; }
    setLoading(true);
    setError(null);
    try {
      const results = await fetchSwapQuotes(tokenIn.address, tokenOut.address, amountIn, tokenIn.decimals, tokenOut.decimals);
      setQuotes(results);
      setSelectedIdx(0);
      if (results.length === 0) setError("No routes found. Try a different pair or amount.");
    } catch { setError("Failed to fetch quotes."); setQuotes([]); }
    setLoading(false);
  }, [amountIn, tokenIn, tokenOut]);

  useEffect(() => { const t = setTimeout(fetchQuotesDebounced, 500); return () => clearTimeout(t); }, [fetchQuotesDebounced]);
  useEffect(() => { if (isSuccess) { setTxSuccess(true); setSwapping(false); setTimeout(() => setTxSuccess(false), 5000); } }, [isSuccess]);

  async function handleSwap() {
    if (!isConnected || !walletAddress) { setError("Connect your wallet first."); return; }
    if (quotes.length === 0) return;
    const quote = quotes[selectedIdx];
    setSwapping(true);
    setError(null);
    const txData = await buildSwapTx(quote, walletAddress, slippage, tokenIn.address, tokenOut.address, amountIn, tokenIn.decimals);
    if (!txData) { setError(`Failed to build ${quote.aggregator} transaction.`); setSwapping(false); return; }
    try { sendTransaction({ to: txData.to, data: txData.data, value: txData.value }); } catch { setError("Transaction rejected."); setSwapping(false); }
  }

  function handleFlip() { const tmp = tokenIn; setTokenIn(tokenOut); setTokenOut(tmp); setQuotes([]); }

  const selectedQuote = quotes[selectedIdx];
  const selectedOut = selectedQuote
    ? parseFloat(selectedQuote.amountOutFormatted) >= 1000
      ? formatNumber(parseFloat(selectedQuote.amountOutFormatted), 2)
      : parseFloat(selectedQuote.amountOutFormatted).toFixed(6)
    : "0.0";

  return (
    <div className="mx-auto max-w-[860px]">
      <div className="flex flex-col md:flex-row gap-4">

        {/* LEFT — Swap input card */}
        <div className="flex-1">
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
              <TokenSelector selected={tokenIn} onChange={(t) => { setTokenIn(t); setQuotes([]); }} exclude={tokenOut.address} />
            </div>

            {/* Flip */}
            <div className="flex justify-center py-1">
              <button onClick={handleFlip} className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-2 text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-secondary)]">
                ↕
              </button>
            </div>

            {/* To */}
            <div className="mb-1 text-[11px] text-[var(--color-text-dim)]">You receive</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-[24px] font-semibold text-[var(--color-text-muted)]">
                {loading ? "..." : selectedOut}
              </div>
              <TokenSelector selected={tokenOut} onChange={(t) => { setTokenOut(t); setQuotes([]); }} exclude={tokenIn.address} />
            </div>

            {/* Slippage */}
            <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
              <span className="text-[11px] text-[var(--color-text-dim)]">Slippage</span>
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setSlippage(s)}
                  className={`rounded-[var(--radius-sm)] px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    slippage === s ? "bg-[var(--color-accent-primary)] text-[#08140F]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  }`}
                >
                  {s}%
                </button>
              ))}
            </div>

            {/* Swap button */}
            {quotes.length > 0 && (
              <button
                onClick={handleSwap}
                disabled={swapping || isPending || isConfirming || !isConnected}
                className="btn-primary mt-4 w-full py-3.5 text-[15px] disabled:opacity-50"
              >
                {!isConnected
                  ? "Connect wallet to swap"
                  : isPending
                    ? "Confirm in wallet..."
                    : isConfirming
                      ? "Swapping..."
                      : `Swap via ${selectedQuote?.aggregator}`}
              </button>
            )}

            {/* Error */}
            {error && (
              <div className="mt-3 rounded-[var(--radius-md)] bg-[rgba(255,71,87,0.08)] px-4 py-2 text-[12px] text-[var(--color-negative)]">
                {error}
              </div>
            )}

            {/* Success */}
            {txSuccess && txHash && (
              <div className="mt-3 rounded-[var(--radius-md)] bg-[rgba(0,232,123,0.08)] px-4 py-2 text-[12px] text-[var(--color-positive)]">
                Swap successful!{" "}
                <a href={`https://monadvision.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline">View tx</a>
              </div>
            )}

            {/* Loading */}
            {loading && !quotes.length && (
              <div className="mt-4 text-center text-[13px] text-[var(--color-text-muted)]">
                Fetching rates...
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Aggregator routes */}
        <div className="w-full md:w-[280px] shrink-0">
          <div className="mb-2 text-[11px] text-[var(--color-text-dim)]">
            {loading ? "Finding best rates..." : quotes.length > 0 ? `${quotes.length} routes found` : "Enter amount to compare"}
          </div>

          <div className="space-y-1.5">
            {quotes.map((q, i) => (
              <button
                key={q.aggregator}
                onClick={() => setSelectedIdx(i)}
                className={`animate-fade-up flex w-full items-center gap-3 rounded-[var(--radius-lg)] border px-3 py-3 text-left transition-all ${
                  selectedIdx === i
                    ? "border-[var(--color-accent-primary)] bg-[rgba(0,232,123,0.06)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-hover)]"
                }`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {/* Radio */}
                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  selectedIdx === i ? "border-[var(--color-accent-primary)]" : "border-[var(--color-text-dim)]"
                }`}>
                  {selectedIdx === i && <div className="h-2 w-2 rounded-full bg-[var(--color-accent-primary)]" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: q.aggregatorColor }} />
                    <span className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
                      {q.aggregator}
                    </span>
                    {i === 0 && (
                      <span className="rounded bg-[rgba(0,232,123,0.15)] px-1.5 py-0.5 text-[8px] font-bold uppercase text-[var(--color-positive)]">
                        Best
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-dim)]">
                    Gas ~{parseInt(q.gasEstimate).toLocaleString()}
                  </div>
                </div>

                <div className="font-mono text-[13px] font-semibold text-[var(--color-text-primary)] shrink-0">
                  {parseFloat(q.amountOutFormatted) >= 1000
                    ? formatNumber(parseFloat(q.amountOutFormatted), 2)
                    : parseFloat(q.amountOutFormatted).toFixed(4)}
                </div>
              </button>
            ))}

            {/* Empty state for routes */}
            {!loading && quotes.length === 0 && amountIn && parseFloat(amountIn) > 0 && (
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-6 text-center text-[12px] text-[var(--color-text-dim)]">
                No routes available
              </div>
            )}

            {loading && (
              <div className="space-y-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-3">
                    <div className="h-3 w-20 rounded bg-[rgba(255,255,255,0.04)]" style={{ animation: "pulse-ring 1.5s ease-in-out infinite" }} />
                    <div className="mt-1.5 h-2.5 w-14 rounded bg-[rgba(255,255,255,0.03)]" style={{ animation: "pulse-ring 1.5s ease-in-out infinite 0.2s" }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
