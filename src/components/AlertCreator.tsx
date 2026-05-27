"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  fetchYieldOpportunitiesWithClientMeta,
  getOpportunityAssetSymbols,
  type YieldOpportunity,
} from "@/services/yields-aggregator";
import {
  readStoredTelegramConnection,
  saveStoredTelegramConnection,
  type StoredTelegramConnection,
} from "@/lib/telegramAlertClient";
import { TELEGRAM_CONNECT_REQUEST_EVENT } from "@/lib/telegramEvents";

type AlertKind = "apr_above" | "apr_below" | "best_market_change" | "new_market" | "daily_digest";

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

function protocolFilterKey(protocol: string) {
  return protocol.trim().toLowerCase();
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "warning";
}) {
  const tones = {
    neutral: "bg-[rgba(255,255,255,0.06)] text-[var(--color-text-secondary)]",
    positive: "bg-[rgba(0,245,204,0.1)] text-[var(--color-positive)]",
    warning: "bg-[rgba(255,184,0,0.12)] text-[var(--color-warning)]",
  };

  return (
    <span className={`rounded-[var(--radius-sm)] px-2 py-1 text-[9px] font-bold uppercase ${tones[tone]}`}>
      {children}
    </span>
  );
}

function notifyAlertsChanged() {
  window.dispatchEvent(new Event("onchain-pulse:alerts-changed"));
}

export function AlertCreator() {
  const [opportunities, setOpportunities] = useState<YieldOpportunity[]>([]);
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
  const [statusTone, setStatusTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setConnection(readStoredTelegramConnection());
    fetchYieldOpportunitiesWithClientMeta()
      .then((result) => setOpportunities(result.data))
      .catch(() => {
        setStatusTone("error");
        setStatus("Rate data is temporarily unavailable, but you can still create broad alerts.");
      });
  }, []);

  useEffect(() => {
    if (kind !== "new_market" && kind !== "daily_digest" && tokenSymbol === "ANY") {
      setTokenSymbol("USDC");
    }
  }, [kind, tokenSymbol]);

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

  const createConnectionCode = useCallback(async () => {
    setBusy(true);
    setStatus("");
    setStatusTone("info");
    try {
      const response = await fetch("/api/alerts/connect", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create Telegram connection.");
      setConnectSession(data);
      setStatusTone("success");
      setStatus("Open Telegram, tap Start, then come back and confirm.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Telegram setup failed.";
      setStatusTone("error");
      setStatus(
        message === "Telegram bot is not configured"
          ? "Telegram alerts are not configured yet. Add TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME, then redeploy."
          : message
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    function handleConnectRequest() {
      const alertCreatorSection = document.getElementById("create-alert");
      if (typeof alertCreatorSection?.scrollIntoView === "function") {
        alertCreatorSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
      void createConnectionCode();
    }

    window.addEventListener(TELEGRAM_CONNECT_REQUEST_EVENT, handleConnectRequest);
    return () => window.removeEventListener(TELEGRAM_CONNECT_REQUEST_EVENT, handleConnectRequest);
  }, [createConnectionCode]);

  async function claimConnection() {
    if (!connectSession) return;
    setBusy(true);
    setStatus("");
    setStatusTone("info");
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
      setStatusTone("success");
      setStatus("Telegram connected. You can create alerts now.");
      notifyAlertsChanged();
    } catch (error) {
      setStatusTone("error");
      setStatus(error instanceof Error ? error.message : "Telegram confirmation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function createAlert() {
    if (!connection) {
      setStatusTone("error");
      setStatus("Connect Telegram before creating an alert.");
      return;
    }

    const threshold = Number(thresholdApr);
    if (needsThreshold && !Number.isFinite(threshold)) {
      setStatusTone("error");
      setStatus("Enter a valid APR percentage.");
      return;
    }

    setBusy(true);
    setStatus("");
    setStatusTone("info");
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
      setStatusTone("success");
      setStatus(`${label} alert created for ${tokenSymbol}.`);
      notifyAlertsChanged();
    } catch (error) {
      setStatusTone("error");
      setStatus(error instanceof Error ? error.message : "Alert creation failed.");
    } finally {
      setBusy(false);
    }
  }

  function applyPreset(preset: "usdc-apr" | "wmon-best" | "daily" | "new-market") {
    if (preset === "usdc-apr") {
      setKind("apr_above");
      setTokenSymbol("USDC");
      setProtocolKey("all");
      setThresholdApr("10");
      setStatusTone("info");
      setStatus("Preset ready: tell me when USDC APR goes above 10%.");
      return;
    }

    if (preset === "wmon-best") {
      setKind("best_market_change");
      setTokenSymbol("WMON");
      setProtocolKey("all");
      setStatusTone("info");
      setStatus("Preset ready: tell me when the best WMON market changes.");
      return;
    }

    if (preset === "daily") {
      setKind("daily_digest");
      setTokenSymbol("ANY");
      setProtocolKey("all");
      setStatusTone("info");
      setStatus("Preset ready: send a daily Telegram summary.");
      return;
    }

    setKind("new_market");
    setTokenSymbol("ANY");
    setProtocolKey("all");
    setStatusTone("info");
    setStatus("Preset ready: tell me when a new market appears.");
  }

  return (
    <section id="create-alert" className="mb-6 scroll-mt-24 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[12px] font-bold uppercase text-[var(--color-accent-primary)]">
            Create Telegram Alert
          </div>
          <h2 className="mt-2 text-[24px] font-bold text-[var(--color-text-primary)]">Build a watch</h2>
          <p className="mt-1 max-w-[720px] text-[12px] leading-relaxed text-[var(--color-text-muted)]">
            Pick the condition, token, protocol scope, and optional APR target. Alerts are based on displayed DeFi rates.
          </p>
        </div>
        {connection ? <Badge tone="positive">Telegram connected</Badge> : <Badge tone="warning">Setup required</Badge>}
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-4">
        {[
          ["USDC above 10%", "Tell me when USDC APR gets interesting.", "usdc-apr"],
          ["WMON best place", "Tell me when the leading WMON market changes.", "wmon-best"],
          ["Daily summary", "Send a daily snapshot of top displayed rates.", "daily"],
          ["New market", "Tell me when a new displayed rate row appears.", "new-market"],
        ].map(([title, description, preset]) => (
          <button
            key={title}
            type="button"
            onClick={() => applyPreset(preset as "usdc-apr" | "wmon-best" | "daily" | "new-market")}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-3 py-3 text-left transition-colors hover:border-[var(--color-accent-primary)]"
          >
            <span className="block text-[12px] font-bold text-[var(--color-text-primary)]">{title}</span>
            <span className="mt-1 block text-[10px] leading-relaxed text-[var(--color-text-muted)]">
              {description}
            </span>
          </button>
        ))}
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
        <div
          role="status"
          className={`mt-3 rounded-[var(--radius-md)] border px-3 py-2 text-[11px] ${
            statusTone === "error"
              ? "border-[rgba(255,184,0,0.45)] bg-[rgba(255,184,0,0.08)] text-[var(--color-warning)]"
              : statusTone === "success"
                ? "border-[rgba(0,245,204,0.42)] bg-[rgba(0,245,204,0.08)] text-[var(--color-positive)]"
                : "border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] text-[var(--color-text-secondary)]"
          }`}
        >
          {status}
        </div>
      )}
    </section>
  );
}
