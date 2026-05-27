"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type AlertKind = "apr_above" | "apr_below" | "best_market_change" | "new_market";
type SelectOption = { value: string; label: string };

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

const ALERT_KIND_OPTIONS: { value: AlertKind; label: string }[] = [
  {
    value: "apr_above",
    label: "APR goes above",
  },
  {
    value: "apr_below",
    label: "APR drops below",
  },
  {
    value: "best_market_change",
    label: "Best place changes",
  },
  {
    value: "new_market",
    label: "New market appears",
  },
];

function protocolFilterKey(protocol: string) {
  return protocol.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
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

function AlertSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <span className="text-[10px] font-semibold uppercase text-[var(--color-text-dim)]">{label}</span>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="mt-1 flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-2 text-left text-[12px] font-semibold text-[var(--color-text-primary)] outline-none transition-colors hover:border-[var(--color-border-hover)] focus:border-[var(--color-accent-primary)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <span className="truncate">{selected?.label}</span>
        <span className={`text-[14px] text-[var(--color-text-secondary)] transition-transform ${open ? "rotate-180" : ""}`}>
          v
        </span>
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[280px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-accent-primary)] bg-[var(--color-bg-surface-solid)] p-1 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
        >
          {options.map((option) => {
            const active = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-left text-[12px] font-semibold transition-colors ${
                  active
                    ? "bg-[var(--color-accent-primary)] text-[#07110C]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {active && <span className="text-[10px]">Selected</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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
  const [telegramOpened, setTelegramOpened] = useState(false);

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
    if (kind !== "new_market" && tokenSymbol === "ANY") {
      setTokenSymbol("USDC");
    }
  }, [kind, tokenSymbol]);

  const needsThreshold = kind === "apr_above" || kind === "apr_below";
  const formDisabled = busy || !connection;
  const tokenChoices = kind === "new_market" ? ["ANY", ...POPULAR_TOKENS] : POPULAR_TOKENS;
  const tokenOptions = tokenChoices.map((symbol) => ({
    value: symbol,
    label: symbol === "ANY" ? "Any token" : symbol,
  }));
  const alertKindOptions = ALERT_KIND_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));
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
  const protocolOptions = [
    { value: "all", label: "All protocols" },
    ...protocolChoices.map((option) => ({ value: option.key, label: option.label })),
  ];

  const createConnectionCode = useCallback(async () => {
    setBusy(true);
    setStatus("");
    setStatusTone("info");
    try {
      const response = await fetch("/api/alerts/connect", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create Telegram connection.");
      setConnectSession(data);
      setTelegramOpened(false);
      setStatusTone("success");
      setStatus("Telegram link created. Use the bot link button, tap Start in Telegram, then confirm here.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Telegram setup failed.";
      setStatusTone("error");
      setStatus(
        message === "Telegram bot is not configured"
          ? "Admin setup needed: add TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME, then redeploy."
          : message
      );
    } finally {
      setBusy(false);
    }
  }, []);

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
      setTelegramOpened(false);
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
      const selectedProtocol = protocolOptions.find((option) => option.value === protocolKey);
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          chatId: connection.chatId,
          tokenSymbol,
          protocolKey,
          protocolLabel: selectedProtocol?.label,
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

  function setupButtonClass(active: boolean, completed = false) {
    return [
      "rounded-[var(--radius-md)] px-4 py-2 text-[12px] font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-45",
      active || completed
        ? "bg-[var(--color-accent-primary)] text-[#07110C] hover:opacity-90"
        : "border border-[var(--color-border)] text-[var(--color-text-muted)]",
    ].join(" ");
  }

  return (
    <section id="create-alert" className="mb-6 scroll-mt-24 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[12px] font-bold uppercase text-[var(--color-accent-primary)]">
            Telegram alerts
          </div>
          <h2 className="mt-2 text-[24px] font-bold text-[var(--color-text-primary)]">Set up rate alerts</h2>
          <p className="mt-1 max-w-[720px] text-[12px] leading-relaxed text-[var(--color-text-muted)]">
            Connect Telegram once, then choose the rate movement you want Onchain Pulse to watch.
          </p>
        </div>
        {connection ? <Badge tone="positive">Telegram connected</Badge> : <Badge tone="warning">Setup required</Badge>}
      </div>

      <div className="space-y-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-4 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-[760px]">
              <div className="text-[10px] font-bold uppercase text-[var(--color-accent-primary)]">
                1. Connect Telegram
              </div>
              <div className="mt-2 text-[15px] font-bold text-[var(--color-text-primary)]">
                {connection ? "Telegram is ready" : "Send alerts to Telegram"}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
                {connection
                  ? "Alerts will be sent to your connected Telegram chat."
                  : "Create a link, use the bot link button, tap Start in Telegram, then return here and confirm."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!connection && (
                <button
                  type="button"
                  onClick={createConnectionCode}
                  disabled={busy || Boolean(connectSession)}
                  className={setupButtonClass(!connectSession, Boolean(connectSession))}
                >
                  Create Telegram link
                </button>
              )}
              {!connection &&
                (connectSession ? (
                  <a
                    href={connectSession.deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setTelegramOpened(true)}
                    className={setupButtonClass(!telegramOpened, telegramOpened)}
                  >
                    Launch bot link
                  </a>
                ) : (
                  <button type="button" disabled className={setupButtonClass(false)}>
                    Launch bot link
                  </button>
                ))}
              {!connection && (
                <button
                  type="button"
                  onClick={claimConnection}
                  disabled={busy || !telegramOpened}
                  className={setupButtonClass(telegramOpened)}
                >
                  I tapped Start
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={`rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-4 py-4 ${connection ? "" : "opacity-70"}`}>
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase text-[var(--color-accent-primary)]">
              2. Create alert
            </div>
            <div className="mt-2 text-[15px] font-bold text-[var(--color-text-primary)]">
              Alert me when a displayed rate changes
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              {connection
                ? "Choose a token, alert type, protocol scope, and target APR when needed."
                : "Connect Telegram first to unlock alert creation."}
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr_0.9fr_0.7fr_auto] lg:items-end">
            <div className="block">
              <AlertSelect
                label="Token"
                value={tokenSymbol}
                disabled={formDisabled}
                options={tokenOptions}
                onChange={(nextValue) => {
                  setTokenSymbol(nextValue);
                  setProtocolKey("all");
                }}
              />
            </div>

            <div className="block">
              <AlertSelect
                label="Alert me when"
                value={kind}
                disabled={formDisabled}
                options={alertKindOptions}
                onChange={(nextValue) => setKind(nextValue as AlertKind)}
              />
            </div>

            <div className="block">
              <AlertSelect
                label="Protocol"
                value={protocolKey}
                disabled={formDisabled}
                options={protocolOptions}
                onChange={setProtocolKey}
              />
            </div>

            <label className={`block ${needsThreshold ? "" : "opacity-45"}`}>
              <span className="text-[10px] font-semibold uppercase text-[var(--color-text-dim)]">APR %</span>
              <input
                value={thresholdApr}
                onChange={(event) => setThresholdApr(event.target.value)}
                disabled={formDisabled || !needsThreshold}
                inputMode="decimal"
                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-primary)] disabled:cursor-not-allowed"
                placeholder="12"
              />
            </label>

            <button
              type="button"
              onClick={createAlert}
              disabled={formDisabled}
              className="rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-4 py-2 text-[12px] font-bold text-[#07110C] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {connection ? "Create alert" : "Connect first"}
            </button>
          </div>
        </div>
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
