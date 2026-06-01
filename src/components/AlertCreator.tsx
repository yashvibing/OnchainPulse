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

type AlertKind =
  | "apr_above"
  | "apr_below"
  | "best_market_change"
  | "new_market"
  | "daily_digest"
  | "daily_news_brief";
type SelectOption = { value: string; label: string };
type ExistingRateMatch = {
  tokenSymbol: string;
  condition: "above" | "below";
  thresholdApr: number;
  protocolScope: string;
  protocol: string;
  apr: number;
};

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
  {
    value: "daily_digest",
    label: "Daily DeFi rates digest",
  },
  {
    value: "daily_news_brief",
    label: "Daily latest news brief",
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

function matchesAlertToken(opp: YieldOpportunity, tokenSymbol: string) {
  if (tokenSymbol === "ANY") return true;
  const selected = tokenSymbol.toUpperCase();
  return getOpportunityAssetSymbols(opp).some((symbol) => symbol.toUpperCase() === selected);
}

function matchesAlertProtocol(opp: YieldOpportunity, protocolKey: string) {
  return protocolKey === "all" || protocolFilterKey(opp.protocol) === protocolKey;
}

function findExistingThresholdMatch(
  opportunities: YieldOpportunity[],
  kind: AlertKind,
  tokenSymbol: string,
  protocolKey: string,
  thresholdApr: number
) {
  if (kind !== "apr_above" && kind !== "apr_below") return undefined;

  const matches = opportunities
    .filter((opp) => opp.action === "LEND")
    .filter((opp) => matchesAlertToken(opp, tokenSymbol))
    .filter((opp) => matchesAlertProtocol(opp, protocolKey))
    .filter((opp) => opp.apr > 0);

  if (kind === "apr_above") {
    return matches
      .filter((opp) => opp.apr >= thresholdApr)
      .sort((a, b) => b.apr - a.apr)[0];
  }

  return matches
    .filter((opp) => opp.apr <= thresholdApr)
    .sort((a, b) => a.apr - b.apr)[0];
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
  const [existingRateMatch, setExistingRateMatch] = useState<ExistingRateMatch | null>(null);

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
    if (kind !== "new_market" && kind !== "daily_digest" && kind !== "daily_news_brief" && tokenSymbol === "ANY") {
      setTokenSymbol("USDC");
    }
    if ((kind === "best_market_change" || kind === "daily_digest" || kind === "daily_news_brief") && protocolKey !== "all") {
      setProtocolKey("all");
    }
  }, [kind, protocolKey, tokenSymbol]);

  const needsThreshold = kind === "apr_above" || kind === "apr_below";
  const isRatesDigest = kind === "daily_digest";
  const isNewsBrief = kind === "daily_news_brief";
  const isDigestStyle = isRatesDigest || isNewsBrief;
  const formDisabled = busy || !connection;
  const protocolDisabled = formDisabled || kind === "best_market_change" || isDigestStyle;
  const tokenChoices = kind === "new_market" || isDigestStyle ? ["ANY", ...POPULAR_TOKENS] : POPULAR_TOKENS;
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
    ...(kind === "best_market_change"
      ? []
      : protocolChoices.map((option) => ({ value: option.key, label: option.label }))),
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
      setStatus("Telegram link created. Next: launch the bot, tap Start, then return and confirm.");
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

    const selectedProtocol = protocolOptions.find((option) => option.value === protocolKey);
    const existingMatch = findExistingThresholdMatch(opportunities, kind, tokenSymbol, protocolKey, threshold);
    if (existingMatch) {
      setExistingRateMatch({
        tokenSymbol,
        condition: kind === "apr_below" ? "below" : "above",
        thresholdApr: threshold,
        protocolScope: selectedProtocol?.label || "All protocols",
        protocol: existingMatch.protocol,
        apr: existingMatch.apr,
      });
      setStatusTone("error");
      setStatus("Alert not created because that condition is already true.");
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
          tokenSymbol: isDigestStyle ? "ANY" : tokenSymbol,
          protocolKey,
          protocolLabel: selectedProtocol?.label,
          thresholdApr: needsThreshold ? threshold : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create alert.");
      const label = ALERT_KIND_OPTIONS.find((option) => option.value === kind)?.label || "Alert";
      setStatusTone("success");
      setStatus(
        isNewsBrief
          ? "Daily latest news brief enabled for 11 PM IST."
          : isRatesDigest
            ? "Daily DeFi rates digest enabled for 11 AM IST."
            : `${label} alert created for ${tokenSymbol}.`
      );
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
            Connect Telegram, then create a watch.
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
                  ? "Alerts go to your connected chat."
                  : "Create a link, launch the bot, tap Start, then confirm."}
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
          {!connection && connectSession && (
            <div className="mt-4 rounded-[var(--radius-md)] border border-[rgba(0,245,204,0.35)] bg-[rgba(0,245,204,0.07)] px-3 py-3 text-[12px] text-[var(--color-text-secondary)]">
              <div className="font-bold text-[var(--color-text-primary)]">Finish Telegram setup</div>
              <ol className="mt-2 grid gap-1 sm:grid-cols-3">
                <li className={telegramOpened ? "text-[var(--color-positive)]" : ""}>1. Launch the bot link</li>
                <li>2. Tap Start in Telegram</li>
                <li>3. Click I tapped Start</li>
              </ol>
            </div>
          )}
        </div>

        <div className={`rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-4 py-4 ${connection ? "" : "opacity-70"}`}>
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase text-[var(--color-accent-primary)]">
              2. Create alert
            </div>
            <div className="mt-2 text-[15px] font-bold text-[var(--color-text-primary)]">
              {isNewsBrief ? "Enable daily news brief" : isRatesDigest ? "Enable daily rates digest" : "Create a watch"}
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              {connection && isNewsBrief
                ? "Receive one Telegram message at 11 PM IST with curated news titles, summaries, and source links."
                : connection && isRatesDigest
                  ? "Receive one Telegram message at 11 AM IST with the top displayed DeFi rates."
                : connection
                  ? "Choose the token, condition, protocol, and APR target."
                  : "Connect Telegram first to unlock alert creation."}
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr_0.9fr_0.7fr_auto] lg:items-end">
            <div className={isDigestStyle ? "hidden" : "block"}>
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

            <div className={isDigestStyle ? "lg:col-span-2" : "block"}>
              <AlertSelect
                label="Alert me when"
                value={kind}
                disabled={formDisabled}
                options={alertKindOptions}
                onChange={(nextValue) => {
                  const nextKind = nextValue as AlertKind;
                  setKind(nextKind);
                  if (nextKind === "best_market_change" || nextKind === "daily_digest" || nextKind === "daily_news_brief") {
                    setProtocolKey("all");
                  }
                }}
              />
            </div>

            <div className={isDigestStyle ? "hidden" : "block"}>
              <AlertSelect
                label="Protocol"
                value={protocolKey}
                disabled={protocolDisabled}
                options={protocolOptions}
                onChange={setProtocolKey}
              />
              {kind === "best_market_change" && (
                <p className="mt-1 text-[10px] leading-relaxed text-[var(--color-text-dim)]">
                  Best-place alerts compare every protocol for this token.
                </p>
              )}
            </div>

            <label className={`block ${isDigestStyle ? "hidden" : needsThreshold ? "" : "opacity-45"}`}>
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
              {connection ? (isNewsBrief ? "Enable brief" : isRatesDigest ? "Enable digest" : "Create alert") : "Connect first"}
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

      {existingRateMatch && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-[520px] rounded-[var(--radius-lg)] border border-[var(--color-border-elevated)] bg-[var(--color-bg-surface-solid)] px-5 py-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
            <div className="text-[11px] font-bold uppercase text-[var(--color-warning)]">
              Alert already active
            </div>
            <h3 className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">
              This condition is already true
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              You selected {existingRateMatch.tokenSymbol} {existingRateMatch.condition}{" "}
              {existingRateMatch.thresholdApr}% APR on {existingRateMatch.protocolScope}, but an opportunity
              already exists on {existingRateMatch.protocol}.
            </p>
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-4 py-3">
              <div className="text-[10px] font-bold uppercase text-[var(--color-text-dim)]">
                Current displayed APR
              </div>
              <div className="mt-1 text-[24px] font-bold text-[var(--color-accent-primary)]">
                {existingRateMatch.apr.toFixed(2)}% APR
              </div>
              <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                {existingRateMatch.tokenSymbol} on {existingRateMatch.protocol}
              </div>
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              Pick another protocol or target.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setExistingRateMatch(null)}
                className="rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-4 py-2 text-[12px] font-bold text-[#07110C] hover:opacity-90"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
