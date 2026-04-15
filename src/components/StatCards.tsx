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
        label="DAILY YIELD"
        value={dailyYield}
        format="usd"
        sub={`≈ ${formatUsd(dailyYield * 365)}/yr`}
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
}: {
  label: string;
  value: number;
  format: "usd" | "int";
  sub?: string;
  accent?: string;
}) {
  const animated = useCountUp(value);
  const display = format === "usd" ? formatUsd(animated) : String(Math.round(animated));

  return (
    <div
      className="card-elevated card-hover flex-1 min-w-[155px] px-5 py-4 transition-shadow duration-300"
      style={{
        ["--glow-color" as string]: accent || "var(--color-accent-primary)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          `0 0 20px ${accent || "var(--color-accent-primary)"}15, inset 0 1px 0 rgba(255,255,255,0.05)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          "inset 0 1px 0 rgba(255,255,255,0.03)";
      }}
    >
      <div className="mb-1 text-[11px] tracking-[0.6px] text-[var(--color-text-muted)]">
        {label}
      </div>
      <div
        className="text-[20px] font-bold tabular-nums animate-count"
        style={{ color: accent || "var(--color-text-primary)" }}
      >
        {display}
      </div>
      {sub && (
        <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
          {sub}
        </div>
      )}
    </div>
  );
}
