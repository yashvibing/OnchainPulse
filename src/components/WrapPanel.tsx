"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useBalance,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import { TOKENS } from "@/config/tokens";
import { WMON_ABI } from "@/lib/abis";

type WrapMode = "wrap" | "unwrap";

const WMON = TOKENS.WMON;
const GAS_BUFFER = parseEther("0.02");

function formatBalance(value?: bigint) {
  if (value === undefined) return "--";
  const amount = Number(formatEther(value));
  if (amount === 0) return "0";
  if (amount < 0.0001) return "<0.0001";
  return amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function parseAmount(value: string) {
  const normalized = value.trim();
  if (!normalized || Number(normalized) <= 0) return null;

  try {
    return parseEther(normalized);
  } catch {
    return null;
  }
}

export function WrapPanel() {
  const { address, isConnected } = useAccount();
  const [mode, setMode] = useState<WrapMode>("wrap");
  const [pendingMode, setPendingMode] = useState<WrapMode>("wrap");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const handledTxHash = useRef<string | undefined>(undefined);

  const {
    data: nativeBalance,
    isLoading: isNativeBalanceLoading,
    refetch: refetchNativeBalance,
  } = useBalance({ address, query: { enabled: isConnected } });
  const {
    data: wrappedBalance,
    isLoading: isWrappedBalanceLoading,
    refetch: refetchWrappedBalance,
  } = useBalance({
    address,
    token: WMON.address,
    query: { enabled: isConnected },
  });

  const {
    data: txHash,
    error: writeError,
    isPending,
    writeContract,
    reset,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const maxWrapAmount = useMemo(() => {
    const value = nativeBalance?.value;
    if (!value || value <= GAS_BUFFER) return 0n;
    return value - GAS_BUFFER;
  }, [nativeBalance?.value]);
  const selectedBalance =
    mode === "wrap" ? maxWrapAmount : wrappedBalance?.value;
  const parsedAmount = parseAmount(amount);
  const exceedsBalance =
    !!parsedAmount && selectedBalance !== undefined && parsedAmount > selectedBalance;
  const canSubmit =
    isConnected &&
    !!parsedAmount &&
    parsedAmount > 0n &&
    !exceedsBalance &&
    !isPending &&
    !isConfirming;

  useEffect(() => {
    if (!isSuccess || !txHash || handledTxHash.current === txHash) return;

    handledTxHash.current = txHash;
    setMessage(
      pendingMode === "wrap"
        ? "Wrapped MON successfully."
        : "Unwrapped WMON successfully."
    );
    setAmount("");
    refetchNativeBalance();
    refetchWrappedBalance();
  }, [
    isSuccess,
    pendingMode,
    txHash,
    refetchNativeBalance,
    refetchWrappedBalance,
  ]);

  useEffect(() => {
    if (writeError) setMessage(writeError.message.split("\n")[0]);
  }, [writeError]);

  function handleModeChange(nextMode: WrapMode) {
    setMode(nextMode);
    setAmount("");
    setMessage(null);
    reset();
  }

  function handleMax() {
    const max = mode === "wrap" ? maxWrapAmount : wrappedBalance?.value || 0n;
    setAmount(max > 0n ? formatEther(max) : "");
    setMessage(null);
  }

  function handleSubmit() {
    if (!parsedAmount || !canSubmit) return;

    setMessage(null);
    setPendingMode(mode);

    if (mode === "wrap") {
      writeContract({
        address: WMON.address,
        abi: WMON_ABI,
        functionName: "deposit",
        value: parsedAmount,
      });
      return;
    }

    writeContract({
      address: WMON.address,
      abi: WMON_ABI,
      functionName: "withdraw",
      args: [parsedAmount],
    });
  }

  return (
    <div className="mx-auto max-w-[860px]">
      <div className="card-elevated p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex-1">
            <div className="mb-3 flex rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] p-1">
              {(["wrap", "unwrap"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => handleModeChange(option)}
                  className={`flex-1 rounded-[var(--radius-sm)] px-3 py-2 text-[12px] font-semibold capitalize transition-colors ${
                    mode === option
                      ? "bg-[var(--color-accent-primary)] text-[#08140F]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] p-4">
              <div className="mb-2 flex items-center justify-between text-[11px] text-[var(--color-text-dim)]">
                <span>{mode === "wrap" ? "MON amount" : "WMON amount"}</span>
                <button
                  onClick={handleMax}
                  disabled={!isConnected}
                  className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)] disabled:opacity-40"
                >
                  Max
                </button>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setMessage(null);
                  }}
                  placeholder="0.0"
                  className="min-w-0 flex-1 bg-transparent text-[24px] font-semibold text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-dim)]"
                />
                <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-[13px] font-semibold text-[var(--color-text-primary)]">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white"
                    style={{ background: mode === "wrap" ? "#6D3BF5" : WMON.logoColor }}
                  >
                    {mode === "wrap" ? "MO" : "WM"}
                  </span>
                  {mode === "wrap" ? "MON" : "WMON"}
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="btn-primary mt-4 w-full py-3.5 text-[15px] disabled:opacity-50"
            >
              {!isConnected
                ? "Connect wallet"
                : isPending
                  ? "Confirm in wallet..."
                  : isConfirming
                    ? "Waiting for confirmation..."
                    : mode === "wrap"
                      ? "Wrap MON"
                      : "Unwrap WMON"}
            </button>

            {exceedsBalance && (
              <div className="mt-3 rounded-[var(--radius-md)] bg-[rgba(255,71,87,0.08)] px-4 py-2 text-[12px] text-[var(--color-negative)]">
                {mode === "wrap"
                  ? "Amount exceeds available MON after reserving 0.02 MON for gas."
                  : "Amount exceeds available WMON balance."}
              </div>
            )}

            {message && (
              <div className="mt-3 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-[12px] text-[var(--color-text-secondary)]">
                {message}
                {txHash && isSuccess && (
                  <>
                    {" "}
                    <a
                      href={`https://monadvision.com/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-positive)] underline"
                    >
                      View tx
                    </a>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="grid w-full gap-2 md:w-[260px]">
            <BalanceRow label="MON" value={nativeBalance?.value} loading={isNativeBalanceLoading} />
            <BalanceRow label="WMON" value={wrappedBalance?.value} loading={isWrappedBalanceLoading} />
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-3 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              {mode === "wrap"
                ? "Wrapping keeps your value 1:1 while making MON usable in token routes and DeFi apps."
                : "Unwrapping converts WMON back into native MON for gas and wallet transfers."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BalanceRow({
  label,
  value,
  loading,
}: {
  label: string;
  value?: bigint;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-3">
      <span className="text-[12px] font-medium text-[var(--color-text-muted)]">{label}</span>
      <span className="font-mono text-[13px] font-semibold text-[var(--color-text-primary)]">
        {loading ? "..." : formatBalance(value)}
      </span>
    </div>
  );
}
