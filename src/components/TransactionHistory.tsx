"use client";

import { useQuery } from "@tanstack/react-query";
import { isValidEvmAddress, shortenAddress } from "@/lib/format";

interface WalletTransaction {
  hash: string;
  timestamp: number | null;
  method: string;
  from: string;
  to: string;
  direction: "in" | "out" | "self" | "unknown";
  amount: string;
  symbol: string;
  valueUsd: number | null;
  status: "success" | "failed" | "unknown";
}

interface TransactionHistoryResponse {
  address: string;
  transactions: WalletTransaction[];
  nextCursor: string;
  fetchedAt: number;
}

function explorerTxUrl(hash: string) {
  return `https://monadvision.com/tx/${hash}`;
}

function portfolioUrl(address: string) {
  return `/app?address=${address}`;
}

function formatDate(timestamp: number | null) {
  if (!timestamp) return "Unknown time";
  const date = new Date(timestamp);
  return date
    .toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(",", "");
}

function directionPrefix(direction: WalletTransaction["direction"]) {
  if (direction === "in") return "+";
  if (direction === "out") return "-";
  return "";
}

function directionLabel(direction: WalletTransaction["direction"]) {
  if (direction === "in") return "Receive";
  if (direction === "out") return "Send";
  if (direction === "self") return "Self";
  return "Activity";
}

function buildHistoryCsv(address: string, transactions: WalletTransaction[]) {
  const rows = [
    ["wallet", "time", "hash", "method", "from", "to", "direction", "amount", "symbol", "value_usd", "status"],
    ...transactions.map((tx) => [
      address,
      tx.timestamp ? new Date(tx.timestamp).toISOString() : "",
      tx.hash,
      tx.method,
      tx.from,
      tx.to,
      tx.direction,
      tx.amount,
      tx.symbol,
      tx.valueUsd ?? "",
      tx.status,
    ]),
  ];

  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function downloadHistoryCsv(address: string, transactions: WalletTransaction[]) {
  const csv = buildHistoryCsv(address, transactions);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `onchain-pulse-history-${shortenAddress(address).replace("...", "-")}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fetchTransactionHistory(address: string) {
  const response = await fetch(`/api/transactions/${address}?limit=20`);
  if (!response.ok) throw new Error("Could not load transaction history.");
  return (await response.json()) as TransactionHistoryResponse;
}

export function TransactionHistory({ address }: { address: string }) {
  const query = useQuery<TransactionHistoryResponse>({
    queryKey: ["transactionHistory", address],
    queryFn: () => fetchTransactionHistory(address),
    enabled: isValidEvmAddress(address),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const transactions = query.data?.transactions || [];

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-4">
        <div>
          <div className="label-caps text-[var(--color-accent-primary)]">
            Transaction history
          </div>
          <h2 className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">
            Recent wallet activity
          </h2>
        </div>
        <button
          type="button"
          onClick={() => downloadHistoryCsv(address, transactions)}
          disabled={transactions.length === 0}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2.5 text-[12px] font-bold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Download CSV
        </button>
      </div>

      {query.isLoading && (
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.04)]"
            />
          ))}
        </div>
      )}

      {query.isError && (
        <div className="p-6 text-center text-[13px] text-[var(--color-text-muted)]">
          Transaction history is unavailable right now.
        </div>
      )}

      {!query.isLoading && !query.isError && transactions.length === 0 && (
        <div className="p-6 text-center text-[13px] text-[var(--color-text-muted)]">
          No recent transactions found for this wallet.
        </div>
      )}

      {!query.isLoading && !query.isError && transactions.length > 0 && (
        <div className="divide-y divide-[var(--color-border)]">
          <div className="px-4 py-3 text-[12px] font-semibold text-[var(--color-text-muted)]">
            {transactions.length} recent transactions
          </div>
          {transactions.map((tx) => {
            const receiverIsAddress = isValidEvmAddress(tx.to);
            const amountLabel = tx.amount
              ? `${directionPrefix(tx.direction)}${tx.amount} ${tx.symbol}`
              : "View transaction";
            const valueLabel =
              typeof tx.valueUsd === "number" && tx.valueUsd > 0
                ? ` ($${tx.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })})`
                : "";

            return (
              <div
                key={tx.hash}
                className="grid gap-3 px-4 py-4 text-[13px] md:grid-cols-[190px_1fr_1fr] md:items-center"
              >
                <div className="space-y-1">
                  <div className="font-medium text-[var(--color-text-secondary)]">
                    {formatDate(tx.timestamp)}
                  </div>
                  <a
                    href={explorerTxUrl(tx.hash)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[12px] text-[var(--color-text-muted)] underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--color-accent-primary)]"
                  >
                    {shortenAddress(tx.hash)}
                  </a>
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-[var(--color-text-primary)]">
                    {tx.method || directionLabel(tx.direction)}
                  </div>
                  {receiverIsAddress ? (
                    <a
                      href={portfolioUrl(tx.to)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[12px] text-[var(--color-text-muted)] underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--color-accent-primary)]"
                    >
                      Receiver {shortenAddress(tx.to)}
                    </a>
                  ) : (
                    <span className="font-mono text-[12px] text-[var(--color-text-dim)]">
                      Receiver unknown
                    </span>
                  )}
                </div>

                <div className="md:text-right">
                  <a
                    href={explorerTxUrl(tx.hash)}
                    target="_blank"
                    rel="noreferrer"
                    className={`font-bold underline decoration-dotted underline-offset-4 ${
                      tx.direction === "out"
                        ? "text-[var(--color-negative)]"
                        : "text-[var(--color-positive)]"
                    }`}
                  >
                    {amountLabel}
                    {valueLabel}
                  </a>
                  {tx.status === "failed" && (
                    <div className="mt-1 text-[11px] font-semibold text-[var(--color-negative)]">
                      Failed
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
