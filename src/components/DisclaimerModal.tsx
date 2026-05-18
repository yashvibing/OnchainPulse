"use client";

import { useEffect, useState } from "react";

// Edit this version when disclaimer wording materially changes and users should accept again.
const DISCLAIMER_VERSION = "2026-05-18-monad-guidelines";
const STORAGE_KEY = `onchainpulse:disclaimer:${DISCLAIMER_VERSION}`;

// Edit this text whenever you want to update the first-visit disclaimer.
const DISCLAIMER_ITEMS = [
  "Onchain Pulse is an independent, unofficial, read-only interface for viewing public wallet data, portfolio positions, and third-party DeFi market data relating to the Monad ecosystem.",
  "Onchain Pulse is not associated with, endorsed by, sponsored by, maintained by, or affiliated with Monad Foundation in any way. Monad Foundation has no role in operating or maintaining this site.",
  "Onchain Pulse does not custody assets, execute transactions, or provide legal, tax, investment, or financial advice.",
  "The Monad network is permissionless. Inclusion of any protocol, asset, vault, scenario, or data source on this interface does not constitute endorsement, approval, audit, verification, due diligence, or recommendation by Onchain Pulse.",
  "Data is sourced from third parties and public RPC providers. It may be incomplete, inaccurate, delayed, or change without notice.",
  "References to rates, APR, APY, liquidity, utilization, holdings, positions, protocols, or scenarios are informational snapshots only and should not be relied on as investment guidance.",
  "Do your own research. You are solely responsible for reviewing protocols and making any decisions based on this information.",
];

export function DisclaimerModal() {
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setAccepted(window.localStorage.getItem(STORAGE_KEY) === "accepted");
    setReady(true);
  }, []);

  function handleContinue() {
    if (!checked) return;
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    setAccepted(true);
  }

  if (!ready || accepted) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div className="relative max-h-[92vh] w-full max-w-[860px] overflow-y-auto border border-[var(--color-border-elevated)] bg-[var(--color-bg-surface-solid)] px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -left-px -top-px h-8 w-8 border-l-2 border-t-2 border-[var(--color-text-primary)]" />
        <div className="pointer-events-none absolute -right-px -bottom-px h-8 w-8 border-b-2 border-r-2 border-[var(--color-text-primary)]" />

        <h2
          id="disclaimer-title"
          className="text-[28px] font-bold text-[var(--color-text-primary)] sm:text-[34px]"
        >
          Disclaimer
        </h2>

        <div className="mt-6 rounded-[var(--radius-sm)] bg-[rgba(255,255,255,0.045)] px-4 py-4 sm:px-6 sm:py-5">
          <ul className="space-y-4">
            {DISCLAIMER_ITEMS.map((item) => (
              <li key={item} className="flex gap-3 text-[16px] leading-relaxed text-[var(--color-text-primary)] sm:text-[20px]">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent-violet)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-3 text-[16px] text-[var(--color-text-primary)] sm:text-[20px]">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="h-5 w-5 accent-[var(--color-accent-violet)]"
            />
            <span>I acknowledge and agree</span>
          </label>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!checked}
            className="rounded-[var(--radius-md)] bg-[var(--color-accent-violet)] px-6 py-3 text-[13px] font-bold uppercase tracking-[0.04em] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[170px]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
