"use client";

import { useState } from "react";
import { isValidEvmAddress } from "@/lib/format";

const DEMO_ADDRESS = "0x02964135319494d129F62e319Af7dE923Cb45B6F";

interface AddressInputProps {
  onSubmit: (address: string) => void;
}

export function AddressInput({ onSubmit }: AddressInputProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

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
    setInput(DEMO_ADDRESS);
    setError("");
    onSubmit(DEMO_ADDRESS);
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
