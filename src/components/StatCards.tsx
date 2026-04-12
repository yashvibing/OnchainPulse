import { formatUsd } from "@/lib/format";

interface StatCardsProps {
  totalValue: number;
  dailyYield: number;
  positionCount: number;
  protocolCount: number;
}

export function StatCards({
  totalValue,
  dailyYield,
  positionCount,
  protocolCount,
}: StatCardsProps) {
  return (
    <div className="mb-5 flex flex-wrap gap-3">
      <StatCard label="TOTAL VALUE" value={formatUsd(totalValue)} />
      <StatCard
        label="DAILY YIELD"
        value={formatUsd(dailyYield)}
        sub={`≈ ${formatUsd(dailyYield * 365)}/yr`}
        accent="var(--color-positive)"
      />
      <StatCard
        label="DEFI POSITIONS"
        value={String(positionCount)}
        sub={`across ${protocolCount} protocol${protocolCount !== 1 ? "s" : ""}`}
        accent="var(--color-accent-violet)"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="card flex-1 min-w-[155px] px-5 py-4">
      <div className="mb-1 text-[11px] tracking-[0.6px] text-[var(--color-text-muted)]">
        {label}
      </div>
      <div
        className="text-[20px] font-bold"
        style={{ color: accent || "var(--color-text-primary)" }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
          {sub}
        </div>
      )}
    </div>
  );
}
