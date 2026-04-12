import { type TransferEvent } from "@/services/transactions";
import { shortenAddress } from "@/lib/format";

interface TransactionListProps {
  events: TransferEvent[];
  isLoading: boolean;
}

function timeAgo(unixSeconds: number | null): string {
  if (unixSeconds === null) return "—";
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixSeconds;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function TransactionList({ events, isLoading }: TransactionListProps) {
  if (isLoading && events.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
        Scanning recent blocks…
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          No token transfers in the last ~70 minutes.
        </p>
        <p className="mx-auto mt-2 max-w-[460px] text-[12px] leading-relaxed text-[var(--color-text-dim)]">
          History is scoped to known tokens via on-chain log queries. Native
          MON moves and unknown tokens don&apos;t appear here. For deeper
          history, see the BlockVision upgrade path in CLAUDE.md.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[60px_1fr_1.4fr_1fr_70px] border-b border-[rgba(255,255,255,0.04)] px-5 py-2.5 text-[11px] text-[var(--color-text-dim)]">
        <span></span>
        <span>Token</span>
        <span>Counterparty</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Age</span>
      </div>
      {/* Rows */}
      {events.map((e, i) => (
        <a
          key={`${e.txHash}-${e.logIndex}`}
          href={`https://monadvision.com/tx/${e.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`grid grid-cols-[60px_1fr_1.4fr_1fr_70px] items-center px-5 py-3 transition-colors hover:bg-[rgba(255,255,255,0.02)] ${
            i < events.length - 1
              ? "border-b border-[rgba(255,255,255,0.025)]"
              : ""
          }`}
        >
          <span
            className={`inline-flex h-6 w-12 items-center justify-center rounded-full text-[11px] font-bold uppercase tracking-wide ${
              e.direction === "in"
                ? "bg-[rgba(20,184,166,0.1)] text-[var(--color-positive)]"
                : "bg-[rgba(239,68,68,0.08)] text-[var(--color-negative)]"
            }`}
          >
            {e.direction === "in" ? "In" : "Out"}
          </span>
          <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
            {e.tokenSymbol}
          </span>
          <span className="font-mono text-[12px] text-[var(--color-text-secondary)]">
            {shortenAddress(e.counterparty)}
          </span>
          <span className="text-right font-mono text-[12px] text-[var(--color-text-primary)]">
            {e.direction === "in" ? "+" : "−"}
            {e.amount}
          </span>
          <span className="text-right text-[12px] text-[var(--color-text-muted)]">
            {timeAgo(e.timestamp)}
          </span>
        </a>
      ))}
    </div>
  );
}
