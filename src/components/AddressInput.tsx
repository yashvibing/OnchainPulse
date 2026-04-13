"use client";

import { useState, useRef } from "react";
import { isValidEvmAddress } from "@/lib/format";

// Curated wallets that light up multiple tabs. Ranked by feature coverage.
const DEMO_WALLETS: { address: string; label: string }[] = [
  // 5 features: 3 LSTs + Neverland (2) + Curvance (2) + UniV3 (8 positions)
  { address: "0x44aa9f1c5d23971210ee16e96ffd95a06c295987", label: "All features" },
  // 5 features: shMON staking + Neverland + Morpho + UniV3 (10 positions)
  { address: "0xb90c0e83f27d34fd838682da1fe7ea0c00bfa251", label: "Morpho + Staking + LP" },
  // 4 features: all 4 LSTs + Neverland + Curvance (4 markets) + 71K MON
  { address: "0xcd6b980029e6e6e0733ac8ec3e02be9410d09799", label: "All 4 staking protocols" },
  // 5 features: all 4 LSTs + Neverland + Curvance + UniV3
  { address: "0xdc2d04e580f5edbf15bf8129384f8a5b2259089c", label: "All 4 LSTs + lending" },
  // 3 features: 20 UniV3 positions + large aprMON staking
  { address: "0x85dc137379f537346607f78842ac11f632cd1a32", label: "20 Uniswap V3 positions" },
  // 2 features: Morpho vaults + Upshift earnAUSD ($236K)
  { address: "0x7362a34eae117b8c88b1edf6afcb94d4a9e7034f", label: "Morpho + Upshift vault" },
];

interface AddressInputProps {
  onSubmit: (address: string) => void;
  initialAddress?: string | null;
}

export function AddressInput({ onSubmit, initialAddress }: AddressInputProps) {
  const [input, setInput] = useState(initialAddress || "");
  const [error, setError] = useState("");
  const demoIndex = useRef(0);

  function handleSubmit() {
    const addr = input.trim();
    if (!isValidEvmAddress(addr)) {
      setError("Enter a valid EVM address (0x...)");
      return;
    }
    setError("");
    onSubmit(addr);
  }

  function handleDemo() {
    const demo = DEMO_WALLETS[demoIndex.current % DEMO_WALLETS.length];
    demoIndex.current += 1;
    setInput(demo.address);
    setError("");
    onSubmit(demo.address);
  }

  return (
    <div className="mb-6">
      <div className="flex gap-2.5 flex-wrap">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Enter wallet address (0x...)"
          className="min-w-[220px] flex-1 rounded-xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-4 py-3 font-mono text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-indigo)]"
        />
        <button
          onClick={handleSubmit}
          className="gradient-brand whitespace-nowrap rounded-xl px-7 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          Track
        </button>
      </div>
      <div className="mt-2 flex items-center gap-3">
        {error && (
          <span className="text-xs text-[var(--color-negative)]">{error}</span>
        )}
        <button
          onClick={handleDemo}
          className="border-none bg-transparent p-0 text-[12px] text-[var(--color-text-muted)] underline hover:text-[var(--color-text-secondary)]"
        >
          Load demo wallet
        </button>
      </div>
    </div>
  );
}
