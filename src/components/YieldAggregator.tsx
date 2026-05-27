"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  useTokenBalances,
} from "@/hooks/usePortfolio";
import {
  calculateLoopStrategies,
  fetchYieldOpportunitiesWithClientMeta,
  filterBorrowOpportunities,
  filterByTokens,
  getBorrowCollateralSymbols,
  getOpportunityAssetSymbols,
  sortOpportunities,
  type LoopStrategy,
  type SortField,
  type YieldOpportunity,
} from "@/services/yields-aggregator";
import {
  formatNumber,
  getPeriodicYieldEstimate,
  isValidEvmAddress,
  shortenAddress,
} from "@/lib/format";
import {
  buildWalletYieldMatches,
  getHeldYieldSymbols,
} from "@/lib/walletOpportunities";
import { getLastAddress, saveAddress } from "@/lib/savedAddresses";
import {
  readStoredTelegramConnection,
  saveStoredTelegramConnection,
  type StoredTelegramConnection,
} from "@/lib/telegramAlertClient";

const POPULAR_TOKENS = [
  "WMON",
  "USDC",
  "USDT0",
  "WETH",
  "AUSD",
  "shMON",
  "aprMON",
  "sMON",
  "gMON",
  "WBTC",
  "cbBTC",
  "USD1",
];

const SUGGESTED_TOKENS = ["USDC", "WETH", "AUSD"];

type AlertKind = "apr_above" | "apr_below" | "best_market_change" | "new_market" | "daily_digest";

interface AlertDraft {
  kind: AlertKind;
  tokenSymbol: string;
  protocolKey: string;
  thresholdApr?: string;
  label: string;
  nonce: number;
}

const ALERT_KIND_OPTIONS: { value: AlertKind; label: string; description: string }[] = [
  {
    value: "apr_above",
    label: "APR goes above",
    description: "Message me when the best matching rate crosses a target.",
  },
  {
    value: "apr_below",
    label: "APR drops below",
    description: "Message me when a watched rate falls under a floor.",
  },
  {
    value: "best_market_change",
    label: "Best place changes",
    description: "Message me when another protocol becomes the top displayed place.",
  },
  {
    value: "new_market",
    label: "New market appears",
    description: "Message me when a new matching DeFi rate row is added.",
  },
  {
    value: "daily_digest",
    label: "Daily digest",
    description: "Send a daily Telegram summary of top matching displayed rates.",
  },
];

function formatUsd(value: number) {
  if (value >= 1_000_000_000) return `$${formatNumber(value / 1_000_000_000, 2)}B`;
  if (value >= 1_000_000) return `$${formatNumber(value / 1_000_000, 2)}M`;
  if (value >= 1_000) return `$${formatNumber(value / 1_000, 1)}K`;
  return `$${formatNumber(value, 0)}`;
}

function formatRateLabel(apr: number) {
  return `${apr.toFixed(2)}% APR`;
}

function getDisplayProtocolIcon(iconUrl?: string) {
  if (!iconUrl) return null;

  try {
    const url = new URL(iconUrl);
    if (url.hostname === "icons.llama.fi") return null;
    return iconUrl;
  } catch {
    return null;
  }
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "blue" | "violet" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-[rgba(255,255,255,0.06)] text-[var(--color-text-secondary)]",
    positive: "bg-[rgba(0,245,204,0.1)] text-[var(--color-positive)]",
    blue: "bg-[rgba(59,130,246,0.12)] text-[var(--color-accent-secondary)]",
    violet: "bg-[rgba(167,139,250,0.12)] text-[var(--color-accent-violet)]",
    warning: "bg-[rgba(255,184,0,0.12)] text-[var(--color-warning)]",
    danger: "bg-[rgba(255,71,87,0.12)] text-[var(--color-negative)]",
  };

  return (
    <span className={`rounded-[var(--radius-sm)] px-2 py-1 text-[9px] font-bold uppercase ${tones[tone]}`}>
      {children}
    </span>
  );
}

function ProtocolMark({ opp }: { opp: YieldOpportunity }) {
  const [iconFailed, setIconFailed] = useState(false);
  const iconUrl = getDisplayProtocolIcon(opp.protocolIcon);
  const initials = opp.protocol
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.06)]"
      aria-hidden="true"
    >
      {iconUrl && !iconFailed ? (
        // Third-party icon CDNs can be blocked by browser response sniffing; fall back cleanly.
        <Image
          src={iconUrl}
          alt=""
          width={32}
          height={32}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setIconFailed(true)}
        />
      ) : (
        <span className="text-[9px] font-bold text-[var(--color-text-secondary)]">{initials || "P"}</span>
      )}
    </div>
  );
}

function AssetStack({ symbols }: { symbols: string[] }) {
  const visibleSymbols = symbols.length > 0 ? symbols.slice(0, 3) : ["?"];

  return (
    <div className="flex -space-x-2">
      {visibleSymbols.map((symbol, index) => (
        <div
          key={`${symbol}-${index}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--color-bg-primary)] bg-[rgba(0,245,204,0.14)] text-[9px] font-extrabold text-[var(--color-positive)]"
          style={{ zIndex: visibleSymbols.length - index }}
        >
          {symbol.slice(0, 2).toUpperCase()}
        </div>
      ))}
    </div>
  );
}

function TokenChip({
  symbol,
  selected,
  onClick,
}: {
  symbol: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[var(--radius-md)] border px-3 py-2 text-[12px] font-semibold transition-all ${
        selected
          ? "border-[var(--color-accent-primary)] bg-[rgba(0,245,204,0.12)] text-[var(--color-positive)]"
          : "border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-secondary)]"
      }`}
    >
      {symbol}
    </button>
  );
}

function TokenSelectorPanel({
  title,
  subtitle,
  tone,
  tokens,
  selectedTokens,
  onSelect,
}: {
  title: string;
  subtitle: string;
  tone: "positive" | "blue";
  tokens: string[];
  selectedTokens: string[];
  onSelect: (symbol: string) => void;
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div
            className={`text-[12px] font-bold uppercase ${
              tone === "positive" ? "text-[var(--color-positive)]" : "text-[var(--color-accent-secondary)]"
            }`}
          >
            {title}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            {subtitle}
          </p>
        </div>
        {selectedTokens.length > 0 && <Badge tone={tone}>{selectedTokens[0]}</Badge>}
      </div>
      <div className="flex flex-wrap gap-2">
        {tokens.map((symbol) => (
          <TokenChip
            key={symbol}
            symbol={symbol}
            selected={selectedTokens.includes(symbol)}
            onClick={() => onSelect(symbol)}
          />
        ))}
      </div>
    </section>
  );
}

function WalletHoldingsPanel({
  address,
  input,
  onInputChange,
  onLoad,
  loading,
  heldSymbols,
  matches,
}: {
  address: string;
  input: string;
  onInputChange: (value: string) => void;
  onLoad: () => void;
  loading: boolean;
  heldSymbols: string[];
  matches: ReturnType<typeof buildWalletYieldMatches>;
}) {
  const bestMatch = matches[0];
  const bestEstimate = bestMatch
    ? getPeriodicYieldEstimate(bestMatch.valueUsd, bestMatch.estimatedDailyUsd)
    : null;
  const matchedSymbols = new Set(matches.map((match) => match.symbol));
  const unmatchedSymbols = heldSymbols.filter((symbol) => !matchedSymbols.has(symbol));

  return (
    <section className="mb-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4">
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[12px] font-bold uppercase text-[var(--color-text-secondary)]">
            Best Places For Wallet Tokens
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            Paste a wallet address. For each token it already holds, we show
            the strongest displayed place we can match.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && onLoad()}
          placeholder="0x wallet address"
          className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-2 font-mono text-[12px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-primary)]"
        />
        <button
          type="button"
          onClick={onLoad}
          className="rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-4 py-2 text-[12px] font-bold text-[#07110C] transition-opacity hover:opacity-90"
        >
          Check wallet
        </button>
      </div>

      {address && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          {!address ? (
            null
          ) : loading ? (
            <div>
              <div className="font-mono text-[11px] text-[var(--color-text-dim)]">
                Wallet {shortenAddress(address)}
              </div>
              <div className="mt-3 h-4 w-48 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
              <div className="mt-2 h-3 w-full max-w-[520px] animate-pulse rounded bg-[rgba(255,255,255,0.05)]" />
            </div>
          ) : heldSymbols.length === 0 ? (
            <div>
              <div className="font-mono text-[11px] text-[var(--color-text-dim)]">
                Wallet {shortenAddress(address)}
              </div>
              <div className="mt-2 text-[12px] text-[var(--color-text-muted)]">
                We did not find wallet tokens that match the displayed markets.
              </div>
            </div>
          ) : matches.length === 0 ? (
            <div>
              <div className="font-mono text-[11px] text-[var(--color-text-dim)]">
                Wallet {shortenAddress(address)}
              </div>
              <div className="mt-2 text-[12px] text-[var(--color-text-muted)]">
                We found supported wallet tokens, but none have a displayed
                rate row right now.
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-[11px] text-[var(--color-text-dim)]">
                    Wallet {shortenAddress(address)}
                  </div>
                  <div className="mt-1 text-[13px] font-semibold text-[var(--color-text-secondary)]">
                    Best displayed place found for {matches.length} wallet token{matches.length === 1 ? "" : "s"}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--color-text-dim)]">
                    These are static recommendations from the current market
                    list. They do not change your supply/borrow filters.
                  </div>
                </div>
              </div>

              {bestMatch && (
                <div
                  className="mb-3 max-w-[520px] rounded-[var(--radius-md)] border border-[var(--color-accent-primary)] bg-[rgba(0,245,204,0.08)] px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="text-[9px] font-bold uppercase text-[var(--color-positive)]">
                        Highest wallet match
                      </div>
                      <div className="truncate text-[15px] font-bold text-[var(--color-text-primary)]">
                        {bestMatch.symbol}
                      </div>
                      <div className="truncate text-[11px] text-[var(--color-text-dim)]">
                        {bestMatch.opportunity.protocol} - wallet holds {bestMatch.balanceLabel}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[14px] font-bold text-[var(--color-positive)]">
                        {formatRateLabel(bestMatch.opportunity.apr)}
                      </div>
                      {bestEstimate && (
                        <div className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                          {bestEstimate.shortLabel} {bestEstimate.formatted}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {matches.slice(0, 6).map((match) => {
                  const estimate = getPeriodicYieldEstimate(match.valueUsd, match.estimatedDailyUsd);

                  return (
                    <div
                      key={`${match.symbol}-${match.opportunity.id}`}
                      className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] px-3 py-3"
                    >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[13px] font-bold text-[var(--color-text-primary)]">
                          {match.symbol}
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--color-text-dim)]">
                          {match.opportunity.protocol} - wallet holds {match.balanceLabel}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[12px] font-bold text-[var(--color-positive)]">
                          {formatRateLabel(match.opportunity.apr)}
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--color-text-dim)]">
                          {estimate.shortLabel} {estimate.formatted}
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>

              {unmatchedSymbols.length > 0 && (
                <div className="mt-3 text-[11px] text-[var(--color-text-dim)]">
                  Wallet tokens without a displayed rate match right now: {unmatchedSymbols.slice(0, 6).join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AlertPanel({
  opportunities,
  watchDraft,
}: {
  opportunities: YieldOpportunity[];
  watchDraft?: AlertDraft | null;
}) {
  const [connection, setConnection] = useState<StoredTelegramConnection | null>(null);
  const [connectSession, setConnectSession] = useState<{
    code: string;
    deepLink: string;
    expiresAt: number;
  } | null>(null);
  const [kind, setKind] = useState<AlertKind>("apr_above");
  const [tokenSymbol, setTokenSymbol] = useState("USDC");
  const [protocolKey, setProtocolKey] = useState("all");
  const [thresholdApr, setThresholdApr] = useState("12");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setConnection(readStoredTelegramConnection());
  }, []);

  useEffect(() => {
    if (kind !== "new_market" && kind !== "daily_digest" && tokenSymbol === "ANY") {
      setTokenSymbol("USDC");
    }
  }, [kind, tokenSymbol]);

  useEffect(() => {
    if (!watchDraft) return;
    setKind(watchDraft.kind);
    setTokenSymbol(watchDraft.tokenSymbol);
    setProtocolKey(watchDraft.protocolKey);
    if (watchDraft.thresholdApr) setThresholdApr(watchDraft.thresholdApr);
    setStatus(`Watch form ready for ${watchDraft.label}.`);
  }, [watchDraft]);

  const needsThreshold = kind === "apr_above" || kind === "apr_below";
  const tokenChoices = kind === "new_market" || kind === "daily_digest" ? ["ANY", ...POPULAR_TOKENS] : POPULAR_TOKENS;
  const protocolChoices = useMemo(() => {
    const token = tokenSymbol.toUpperCase();
    const map = new Map<string, string>();
    opportunities.forEach((opp) => {
      if (opp.action !== "LEND") return;
      if (token !== "ANY") {
        const assets = getOpportunityAssetSymbols(opp).map((symbol) => symbol.toUpperCase());
        if (!assets.includes(token)) return;
      }
      const key = protocolFilterKey(opp.protocol);
      if (!map.has(key)) map.set(key, opp.protocol);
    });
    return [...map.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [opportunities, tokenSymbol]);

  async function createConnectionCode() {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/alerts/connect", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create Telegram connection.");
      setConnectSession(data);
      setStatus("Open Telegram, tap Start, then come back and confirm.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Telegram setup failed.");
    } finally {
      setBusy(false);
    }
  }

  async function claimConnection() {
    if (!connectSession) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/alerts/connect/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: connectSession.code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not confirm Telegram.");

      const nextConnection = {
        chatId: String(data.chatId),
        connectedAt: Number(data.connectedAt || Date.now()),
      };
      saveStoredTelegramConnection(nextConnection);
      setConnection(nextConnection);
      setConnectSession(null);
      setStatus("Telegram connected. You can create alerts now.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Telegram confirmation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function createAlert() {
    if (!connection) {
      setStatus("Connect Telegram before creating an alert.");
      return;
    }

    const threshold = Number(thresholdApr);
    if (needsThreshold && !Number.isFinite(threshold)) {
      setStatus("Enter a valid APR percentage.");
      return;
    }

    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          chatId: connection.chatId,
          tokenSymbol,
          protocolKey,
          thresholdApr: needsThreshold ? threshold : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create alert.");
      const label = ALERT_KIND_OPTIONS.find((option) => option.value === kind)?.label || "Alert";
      setStatus(`${label} alert created for ${tokenSymbol}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Alert creation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[12px] font-bold uppercase text-[var(--color-accent-primary)]">
            Telegram Alerts
          </div>
          <p className="mt-1 max-w-[680px] text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            Watch displayed rates and get a Telegram message when APR crosses a target,
            a watched rate drops, the best place changes, or a new market appears.
          </p>
        </div>
        {connection ? (
          <div className="flex flex-wrap gap-2">
            <a
              href="/alerts"
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[11px] font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
            >
              Manage alerts
            </a>
            <Badge tone="positive">Telegram connected</Badge>
          </div>
        ) : (
          <Badge tone="warning">Setup required</Badge>
        )}
      </div>

      {!connection && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-3 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                Connect Telegram once
              </div>
              <div className="mt-1 text-[10px] text-[var(--color-text-dim)]">
                The bot needs one Start message so it knows where to send alerts.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={createConnectionCode}
                disabled={busy}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[11px] font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] disabled:opacity-50"
              >
                Create Telegram link
              </button>
              {connectSession && (
                <>
                  <a
                    href={connectSession.deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-3 py-2 text-[11px] font-bold text-[#07110C] hover:opacity-90"
                  >
                    Open Telegram
                  </a>
                  <button
                    type="button"
                    onClick={claimConnection}
                    disabled={busy}
                    className="rounded-[var(--radius-md)] border border-[var(--color-accent-primary)] px-3 py-2 text-[11px] font-semibold text-[var(--color-positive)] disabled:opacity-50"
                  >
                    Confirm
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_auto] lg:items-end">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-[var(--color-text-dim)]">Alert type</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as AlertKind)}
            className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
          >
            {ALERT_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[10px] text-[var(--color-text-dim)]">
            {ALERT_KIND_OPTIONS.find((option) => option.value === kind)?.description}
          </span>
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-[var(--color-text-dim)]">Token</span>
          <select
            value={tokenSymbol}
            onChange={(event) => {
              setTokenSymbol(event.target.value);
              setProtocolKey("all");
            }}
            className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
          >
            {tokenChoices.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol === "ANY" ? "Any token" : symbol}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-[var(--color-text-dim)]">Protocol</span>
          <select
            value={protocolKey}
            onChange={(event) => setProtocolKey(event.target.value)}
            className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
          >
            <option value="all">All protocols</option>
            {protocolChoices.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={`block ${needsThreshold ? "" : "opacity-45"}`}>
          <span className="text-[10px] font-semibold uppercase text-[var(--color-text-dim)]">APR %</span>
          <input
            value={thresholdApr}
            onChange={(event) => setThresholdApr(event.target.value)}
            disabled={!needsThreshold}
            inputMode="decimal"
            className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-primary)] disabled:cursor-not-allowed"
            placeholder="12"
          />
        </label>

        <button
          type="button"
          onClick={createAlert}
          disabled={busy || !connection}
          className="rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-4 py-2 text-[12px] font-bold text-[#07110C] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Create alert
        </button>
      </div>

      {status && (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-3 py-2 text-[11px] text-[var(--color-text-secondary)]">
          {status}
        </div>
      )}
    </section>
  );
}

function SortButton({
  label,
  field,
  current,
  onClick,
}: {
  label: string;
  field: SortField;
  current: SortField;
  onClick: (field: SortField) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(field)}
      className={`rounded-[var(--radius-md)] border px-3 py-2 text-[12px] font-semibold transition-colors ${
        current === field
          ? "border-[var(--color-accent-primary)] bg-[rgba(0,245,204,0.1)] text-[var(--color-positive)]"
          : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      {label}
    </button>
  );
}

function protocolFilterKey(protocol: string) {
  return protocol.trim().toLowerCase();
}

function getOpportunityActionBadge(opp: YieldOpportunity): {
  label: string;
  tone: "positive" | "blue" | "violet";
} {
  if (opp.action === "BORROW") return { label: "Borrow", tone: "blue" };
  if (opp.opportunityType === "Stake") return { label: "Stake", tone: "positive" };
  if (opp.opportunityType === "LP") return { label: "LP", tone: "violet" };
  if (opp.opportunityType === "Vault") return { label: "Vault", tone: "violet" };
  return { label: "Lend", tone: "positive" };
}

function preferredProtocolLabel(current: string | undefined, next: string) {
  if (!current) return next;
  const currentLooksLowercase = current === current.toLowerCase();
  const nextLooksLowercase = next === next.toLowerCase();
  return currentLooksLowercase && !nextLooksLowercase ? next : current;
}

function ProtocolFilter({
  options,
  selected,
  onSelect,
}: {
  options: { key: string; label: string; count: number }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <label className="flex min-w-[220px] items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2">
      <span className="text-[11px] font-semibold uppercase text-[var(--color-text-dim)]">
        Protocol
      </span>
      <select
        value={selected}
        onChange={(event) => onSelect(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-[var(--color-text-secondary)] outline-none"
      >
        <option value="all">All protocols</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

function OpportunityRow({
  opp,
  onWatchMarket,
}: {
  opp: YieldOpportunity;
  onWatchMarket?: (opp: YieldOpportunity) => void;
}) {
  const assetSymbols = getOpportunityAssetSymbols(opp);
  const collateralSymbols = getBorrowCollateralSymbols(opp);
  const tokenLabel =
    assetSymbols.length > 0 ? assetSymbols.join(" / ") : opp.tokens.map((token) => token.symbol).join(" / ");
  const actionBadge = getOpportunityActionBadge(opp);

  return (
    <div className="group block rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4 transition-all hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-card-hover)]">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px] md:items-center">
        <div className="flex min-w-0 gap-3">
          <AssetStack symbols={assetSymbols} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-[14px] font-bold text-[var(--color-text-primary)]">
                {tokenLabel}
              </span>
              <Badge tone={actionBadge.tone}>{actionBadge.label}</Badge>
            </div>
            <div className="mt-2 flex min-w-0 items-center gap-2">
              <ProtocolMark opp={opp} />
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold text-[var(--color-text-secondary)]">
                  {opp.protocol}
                </div>
                <div className="truncate text-[11px] text-[var(--color-text-dim)]">
                  {opp.name}
                </div>
              </div>
            </div>
            {opp.action === "BORROW" && (
              <div className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                Supply/collateral: {collateralSymbols.join(", ")}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.035)] px-3 py-3 md:bg-transparent md:px-0 md:py-0">
          <div>
            <div className="text-[10px] uppercase text-[var(--color-text-dim)]">Displayed APR</div>
            <div className="mt-1 text-[16px] font-bold text-[var(--color-positive)]">
              {formatRateLabel(opp.apr)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--color-text-dim)]">TVL</div>
            <div className="mt-1 font-mono text-[13px] font-semibold text-[var(--color-text-secondary)]">
              {formatUsd(opp.tvl)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-[var(--color-text-dim)]">Alert</div>
            {opp.action === "LEND" ? (
              <button
                type="button"
                onClick={() => onWatchMarket?.(opp)}
                className="mt-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[10px] font-bold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent-primary)] hover:text-[var(--color-positive)]"
              >
                Watch
              </button>
            ) : (
              <div className="mt-1 text-[10px] text-[var(--color-text-dim)]">-</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-[var(--color-text-dim)]">Open</div>
            <a
              href={opp.depositUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[15px] text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-text-primary)]"
            >
              &gt;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoopStrategyRow({ strategy }: { strategy: LoopStrategy }) {
  const riskTone = {
    low: "positive",
    medium: "warning",
    high: "danger",
  } as const;

  return (
    <a
      href={strategy.depositUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4 transition-all hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-card-hover)]"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-bold text-[var(--color-text-primary)]">
              Supply {strategy.supplyToken} / Borrow {strategy.borrowToken}
            </span>
            <Badge tone={riskTone[strategy.liquidationRisk]}>{strategy.liquidationRisk} risk</Badge>
          </div>
          <div className="mt-2 grid gap-1 text-[12px] text-[var(--color-text-muted)] md:grid-cols-2">
            <span>
              Supply on <span className="text-[var(--color-text-secondary)]">{strategy.supplyProtocol}</span>{" "}
              displayed APR{" "}
              <span className="text-[var(--color-positive)]">{formatRateLabel(strategy.supplyApr)}</span>
            </span>
            <span>
              Borrow on <span className="text-[var(--color-text-secondary)]">{strategy.borrowProtocol}</span>{" "}
              {strategy.borrowApr > 0 && (
                <span className="text-[var(--color-accent-secondary)]">+{formatRateLabel(strategy.borrowApr)} incentive</span>
              )}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.035)] px-3 py-3 text-right">
          <div>
            <div className="text-[10px] text-[var(--color-text-dim)]">Est. 1x</div>
            <div className="font-semibold text-[var(--color-text-primary)]">{formatRateLabel(strategy.netAprAt1x)}</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-dim)]">Est. 2x</div>
            <div className="font-semibold text-[var(--color-positive)]">{formatRateLabel(strategy.netAprAt2x)}</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-dim)]">Est. 3x</div>
            <div className="font-semibold text-[var(--color-positive)]">{formatRateLabel(strategy.netAprAt3x)}</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-dim)]">Max</div>
            <div className="font-semibold text-[var(--color-text-secondary)]">{strategy.maxLeverage}x</div>
          </div>
        </div>
      </div>
    </a>
  );
}

function EmptyOpportunities({
  label,
  onPickToken,
}: {
  label: string;
  onPickToken?: (symbol: string) => void;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-8 text-center">
      <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{label}</p>
      {onPickToken && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SUGGESTED_TOKENS.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => onPickToken(symbol)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
            >
              Try {symbol}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OpportunitySection({
  title,
  subtitle,
  emptyLabel,
  opportunities,
  onPickToken,
  onWatchMarket,
}: {
  title: string;
  subtitle: string;
  emptyLabel: string;
  opportunities: YieldOpportunity[];
  onPickToken?: (symbol: string) => void;
  onWatchMarket?: (opp: YieldOpportunity) => void;
}) {
  return (
    <section className="flex-1">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]">{title}</h2>
          <p className="mt-1 text-[11px] text-[var(--color-text-dim)]">{subtitle}</p>
        </div>
        <Badge>{opportunities.length}</Badge>
      </div>
      <div className="space-y-2 md:max-h-[620px] md:overflow-y-auto md:pr-1">
        {opportunities.slice(0, 30).map((opp, index) => (
          <div key={`${opp.id}-${index}`} style={{ animationDelay: `${index * 25}ms` }} className="animate-fade-up">
            <OpportunityRow opp={opp} onWatchMarket={onWatchMarket} />
          </div>
        ))}
        {opportunities.length === 0 && (
          <EmptyOpportunities label={emptyLabel} onPickToken={onPickToken} />
        )}
      </div>
    </section>
  );
}

function AggregatorSkeleton() {
  return (
    <div>
      <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4">
        <div className="h-4 w-52 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
        <div className="mt-3 h-3 w-full max-w-[560px] animate-pulse rounded bg-[rgba(255,255,255,0.05)]" />
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
            <div className="h-4 w-28 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
            <div className="mt-4 flex flex-wrap gap-2">
              {Array.from({ length: 10 }).map((__, tokenIndex) => (
                <div key={tokenIndex} className="h-8 w-16 animate-pulse rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.06)]" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, sectionIndex) => (
          <div key={sectionIndex} className="space-y-2">
            {Array.from({ length: 5 }).map((__, rowIndex) => (
              <div key={rowIndex} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 animate-pulse rounded-full bg-[rgba(255,255,255,0.08)]" />
                  <div className="flex-1">
                    <div className="h-4 w-28 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
                    <div className="mt-2 h-3 w-44 animate-pulse rounded bg-[rgba(255,255,255,0.05)]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function YieldAggregator() {
  const [allOpps, setAllOpps] = useState<YieldOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataStatus, setDataStatus] = useState<{
    cacheStatus?: string;
    fetchedAt?: number;
  }>({});
  const [lendTokens, setLendTokens] = useState<string[]>([]);
  const [borrowTokens, setBorrowTokens] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>("apr");
  const [protocolFilter, setProtocolFilter] = useState("all");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletInput, setWalletInput] = useState("");
  const [alertDraft, setAlertDraft] = useState<AlertDraft | null>(null);
  const walletBalances = useTokenBalances(walletAddress || null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addressParam = params.get("address") || getLastAddress();
    const lendParam = params.get("lend");
    if (addressParam && isValidEvmAddress(addressParam)) {
      setWalletAddress(addressParam);
      setWalletInput(addressParam);
    }
    if (lendParam) {
      setLendTokens([lendParam]);
    }

    fetchYieldOpportunitiesWithClientMeta()
      .then((result) => {
        setAllOpps(result.data);
        setDataStatus({
          cacheStatus: result.cacheStatus,
          fetchedAt: result.fetchedAt || Date.now(),
        });
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        setError("Yield data is temporarily unavailable.");
        setLoading(false);
      });
  }, []);

  function selectToken(list: string[], setList: (value: string[]) => void, symbol: string) {
    setList(list.includes(symbol) ? [] : [symbol]);
  }

  const hasLendSelection = lendTokens.length > 0;
  const hasBorrowSelection = borrowTokens.length > 0;
  const showSupplyOnly = hasLendSelection && !hasBorrowSelection;
  const showBorrowOnly = hasBorrowSelection && !hasLendSelection;
  const showLooping = hasLendSelection && hasBorrowSelection;
  const baseLendOpps = filterByTokens(allOpps, lendTokens, "LEND");
  const baseBorrowOpps = filterBorrowOpportunities(allOpps, borrowTokens, showLooping ? lendTokens : []);
  const protocolCounts = new Map<string, { label: string; count: number }>();
  const protocolSource = showSupplyOnly
    ? baseLendOpps
    : showBorrowOnly
      ? baseBorrowOpps
      : [...baseLendOpps, ...baseBorrowOpps];
  protocolSource.forEach((opp) => {
    const key = protocolFilterKey(opp.protocol);
    const existing = protocolCounts.get(key);
    protocolCounts.set(key, {
      label: preferredProtocolLabel(existing?.label, opp.protocol),
      count: (existing?.count || 0) + 1,
    });
  });
  const protocolOptions = [...protocolCounts.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 30);
  const activeProtocol = protocolFilter === "all" || protocolCounts.has(protocolFilter) ? protocolFilter : "all";
  const filterByProtocol = (opps: YieldOpportunity[]) =>
    activeProtocol === "all"
      ? opps
      : opps.filter((opp) => protocolFilterKey(opp.protocol) === activeProtocol);
  const lendOpps = sortOpportunities(filterByProtocol(baseLendOpps), sortField);
  const borrowOpps = sortOpportunities(filterByProtocol(baseBorrowOpps), sortField);
  const baseLoopStrategies = showLooping
    ? calculateLoopStrategies(allOpps, lendTokens, borrowTokens)
    : [];
  const loopStrategies = activeProtocol === "all"
    ? baseLoopStrategies
    : baseLoopStrategies.filter(
        (strategy) =>
          protocolFilterKey(strategy.supplyProtocol) === activeProtocol ||
          protocolFilterKey(strategy.borrowProtocol) === activeProtocol
      );
  const walletTokens = walletBalances.data || [];
  const walletMatches = buildWalletYieldMatches(walletTokens, allOpps);
  const heldYieldSymbols = getHeldYieldSymbols(walletTokens);

  function loadWalletHoldings() {
    const nextAddress = walletInput.trim();
    if (!isValidEvmAddress(nextAddress)) return;
    saveAddress(nextAddress);
    setWalletAddress(nextAddress);
    const params = new URLSearchParams(window.location.search);
    params.set("address", nextAddress);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", nextUrl);
  }

  function prefillWatchMarket(opp: YieldOpportunity) {
    const assets = getOpportunityAssetSymbols(opp);
    const tokenSymbol = assets[0] || opp.tokens[0]?.symbol || "ANY";
    const protocolKey = protocolFilterKey(opp.protocol);
    const threshold = Math.max(0, opp.apr - 1);

    setAlertDraft({
      kind: "apr_below",
      tokenSymbol,
      protocolKey,
      thresholdApr: threshold.toFixed(2),
      label: `${tokenSymbol} on ${opp.protocol}`,
      nonce: Date.now(),
    });
  }

  if (loading) return <AggregatorSkeleton />;

  if (error) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-8 text-center">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{error}</p>
        <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
          Please try again in a moment.
        </p>
      </div>
    );
  }

  return (
    <div>
      <WalletHoldingsPanel
        address={walletAddress}
        input={walletInput}
        onInputChange={setWalletInput}
        onLoad={loadWalletHoldings}
        loading={walletBalances.isLoading}
        heldSymbols={heldYieldSymbols}
        matches={walletMatches}
      />

      {dataStatus.fetchedAt && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-dim)]">
          <span>
            Rates updated {new Date(dataStatus.fetchedAt).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {dataStatus.cacheStatus === "stale" && (
            <>
              <span>·</span>
              <span>Using cached rates</span>
            </>
          )}
        </div>
      )}

      <AlertPanel opportunities={allOpps} watchDraft={alertDraft} />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <TokenSelectorPanel
          title="Supply / Deposit"
          subtitle="Pick one asset to see lending, staking, LP, and vault opportunities."
          tone="positive"
          tokens={POPULAR_TOKENS}
          selectedTokens={lendTokens}
          onSelect={(symbol) => selectToken(lendTokens, setLendTokens, symbol)}
        />
        <TokenSelectorPanel
          title="Borrow"
          subtitle="Pick one asset to see borrow markets and required collateral."
          tone="blue"
          tokens={POPULAR_TOKENS}
          selectedTokens={borrowTokens}
          onSelect={(symbol) => selectToken(borrowTokens, setBorrowTokens, symbol)}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold uppercase text-[var(--color-text-dim)]">
            Sort by
          </span>
          <SortButton label="Displayed APR" field="apr" current={sortField} onClick={setSortField} />
          <SortButton label="TVL" field="tvl" current={sortField} onClick={setSortField} />
        </div>
        <ProtocolFilter
          options={protocolOptions}
          selected={activeProtocol}
          onSelect={setProtocolFilter}
        />
      </div>

      {!hasLendSelection && !hasBorrowSelection && (
        <div className="grid gap-6 md:grid-cols-2">
          <OpportunitySection
            title="Supply / Deposit Opportunities"
            subtitle="Lending, staking, LP, and vault rows for assets relating to Monad."
            emptyLabel="No supply or deposit opportunities found."
            opportunities={lendOpps}
            onPickToken={(symbol) => setLendTokens([symbol])}
            onWatchMarket={prefillWatchMarket}
          />
          <OpportunitySection
            title="Borrow Markets"
            subtitle="Borrow rows include collateral hints where available."
            emptyLabel="No borrow markets found."
            opportunities={borrowOpps}
            onPickToken={(symbol) => setBorrowTokens([symbol])}
            onWatchMarket={prefillWatchMarket}
          />
        </div>
      )}

      {showSupplyOnly && (
        <OpportunitySection
          title={`Supply / deposit opportunities for ${lendTokens.join(", ")}`}
          subtitle="Matching lending, staking, LP, and vault rows for this token."
          emptyLabel="No supply or deposit opportunities found for this token."
          opportunities={lendOpps}
          onPickToken={(symbol) => setLendTokens([symbol])}
          onWatchMarket={prefillWatchMarket}
        />
      )}

      {showBorrowOnly && (
        <OpportunitySection
          title={`Borrow markets for ${borrowTokens.join(", ")}`}
          subtitle="Borrow market rows show collateral hints where available."
          emptyLabel="No borrow markets found for this token."
          opportunities={borrowOpps}
          onPickToken={(symbol) => setBorrowTokens([symbol])}
          onWatchMarket={prefillWatchMarket}
        />
      )}

      {showLooping && (
        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]">
                Loop Scenarios
              </h2>
              <p className="mt-1 text-[11px] text-[var(--color-text-dim)]">
                Scenario using {lendTokens.join(", ")} as supply and {borrowTokens.join(", ")} as borrow. Displayed APR does not include unknown base borrow cost.
              </p>
            </div>
            <Badge tone="positive">{loopStrategies.length}</Badge>
          </div>
          <div className="space-y-2">
            {loopStrategies.map((strategy, index) => (
              <div
                key={`${strategy.supplyProtocol}-${strategy.borrowProtocol}-${strategy.supplyToken}-${strategy.borrowToken}-${index}`}
                className="animate-fade-up"
                style={{ animationDelay: `${index * 25}ms` }}
              >
                <LoopStrategyRow strategy={strategy} />
              </div>
            ))}
            {loopStrategies.length === 0 && (
              <EmptyOpportunities
                label="No loop scenarios available for this combination."
                onPickToken={(symbol) => setLendTokens([symbol])}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
