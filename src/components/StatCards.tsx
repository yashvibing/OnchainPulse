"use client";

import { useEffect, useRef, useState } from "react";
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
      <StatCard label="TOTAL VALUE" value={totalValue} format="usd" />
      <StatCard
        label="EST. DAILY EARNINGS"
        value={dailyYield}
        format="usd"
        sub="From staking, vault, and lending APR/APY"
        note="Estimate only. Rates and balances can change."
        accent="var(--color-positive)"
      />
      <StatCard
        label="DEFI POSITIONS"
        value={positionCount}
        format="int"
        sub={`across ${protocolCount} protocol${protocolCount !== 1 ? "s" : ""}`}
        accent="var(--color-accent-violet)"
      />
    </div>
  );
}

// Animate a number counting up from 0 to target
function useCountUp(target: number, duration = 600): number {
  const [current, setCurrent] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    if (target === prev.current) return;
    const start = prev.current;
    const diff = target - start;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(start + diff * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
    prev.current = target;
  }, [target, duration]);

  return current;
}

function StatCard({
  label,
  value,
  format,
  sub,
  accent,
  note,
}: {
  label: string;
  value: number;
  format: "usd" | "int";
  sub?: string;
  accent?: string;
  note?: string;
}) {
  const animated = useCountUp(value);
  const display = format === "usd" ? formatUsd(animated) : String(Math.round(animated));

  return (
    <div
      className="card-elevated card-hover flex-1 min-w-[155px] border-t-4 px-5 py-4"
      style={{
        borderTopColor: accent || "var(--color-accent-primary)",
      }}
    >
      <div className="label-caps mb-2 text-[var(--color-text-muted)]">
        {label}
      </div>
      <div
        className="animate-count font-mono text-[20px] font-semibold tabular-nums"
        style={{ color: accent || "var(--color-text-primary)" }}
      >
        {display}
      </div>
      {sub && (
        <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
          {sub}
        </div>
      )}
      {note && (
        <div className="mt-2 text-[10px] leading-relaxed text-[var(--color-text-dim)]">
          {note}
        </div>
      )}
    </div>
  );
}
