"use client";

import { useState, useRef } from "react";
import { isValidEvmAddress } from "@/lib/format";

const DEMO_WALLETS: { address: string; label: string }[] = [
  { address: "0x5e073494678fb7fa4a05bb17d45941dd9dc469c1", label: "Staking + Neverland" },
  { address: "0x9a4Ff17Da01f5821b54c3cfeB54211846Cf703ff", label: "Uniswap V3 LP" },
  { address: "0x33a7f808a362d2c780d1c6eea9b52179a441fdf9", label: "Neverland (4 reserves)" },
  { address: "0xEc8A675289BEb9cbEDBE5E8c91059668E2192Df8", label: "Curvance" },
  { address: "0x7362a34eae117b8c88b1edf6afcb94d4a9e7034f", label: "Morpho + Upshift" },
  { address: "0x1722445FA07a56dbae3bAd63DEb6C1d30983cbf4", label: "shMON/WMON LP" },
];

interface AddressInputProps {
  onSubmit: (address: string) => void;
}

export function AddressInput({ onSubmit }: AddressInputProps) {
  const [input, setInput] = useState("");
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
