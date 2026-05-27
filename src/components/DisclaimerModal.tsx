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
  const [showFullText, setShowFullText] = useState(false);

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

        <div>
          <div className="label-caps text-[var(--color-accent-primary)]">
            Before you continue
          </div>
          <h2
            id="disclaimer-title"
            className="mt-2 text-[28px] font-bold text-[var(--color-text-primary)] sm:text-[34px]"
          >
            Onchain Pulse is read-only market data
          </h2>
          <p className="mt-3 max-w-[720px] text-[15px] leading-relaxed text-[var(--color-text-secondary)] sm:text-[17px]">
            We do not custody assets, execute transactions, or provide financial advice.
            Data can be delayed or incomplete, so use it as research context before
            making your own decisions.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Read-only", "No wallet connection or transaction signing is required."],
            ["Independent", "Not affiliated with Monad Foundation or any protocol."],
            ["Informational", "Rates and holdings are snapshots, not recommendations."],
          ].map(([title, description]) => (
            <div
              key={title}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-4 py-3"
            >
              <div className="text-[12px] font-bold text-[var(--color-text-primary)]">
                {title}
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                {description}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[var(--radius-sm)] bg-[rgba(255,255,255,0.045)] px-4 py-4 sm:px-6 sm:py-5">
          <button
            type="button"
            onClick={() => setShowFullText((value) => !value)}
            className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--color-accent-primary)] hover:opacity-80"
          >
            {showFullText ? "Hide full disclaimer" : "Read full disclaimer"}
          </button>

          {showFullText && (
            <ul className="mt-4 space-y-3">
              {DISCLAIMER_ITEMS.map((item) => (
                <li key={item} className="flex gap-3 text-[13px] leading-relaxed text-[var(--color-text-primary)] sm:text-[15px]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent-violet)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-3 text-[15px] text-[var(--color-text-primary)] sm:text-[17px]">
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
