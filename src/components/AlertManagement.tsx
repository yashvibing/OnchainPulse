"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearStoredTelegramAlertState,
  readStoredTelegramConnection,
  readStoredTelegramIdentity,
  type StoredTelegramConnection,
} from "@/lib/telegramAlertClient";

type AlertKind =
  | "apr_above"
  | "apr_below"
  | "best_market_change"
  | "new_market"
  | "daily_digest"
  | "daily_news_brief"
  | "token_market_new"
  | "token_volume_above"
  | "token_liquidity_above"
  | "token_price_move";

interface ManagedAlert {
  id: string;
  kind: AlertKind;
  tokenSymbol: string;
  protocolKey?: string;
  protocolLabel?: string;
  thresholdApr?: number;
  status: "active" | "paused";
  createdAt: number;
  updatedAt: number;
  lastTriggeredAt?: number;
  lastApr?: number;
}

const KIND_LABELS: Record<AlertKind, string> = {
  apr_above: "APR goes above",
  apr_below: "APR drops below",
  best_market_change: "Best place changes",
  new_market: "New market appears",
  daily_digest: "DeFi rates digest",
  daily_news_brief: "Latest news brief",
  token_market_new: "New token market",
  token_volume_above: "Token volume",
  token_liquidity_above: "Token liquidity",
  token_price_move: "Token price move",
};

function formatDate(value?: number) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatApr(value?: number) {
  return typeof value === "number" ? `${value.toFixed(2)}% APR` : "Checking soon";
}

function formatUsd(value?: number) {
  if (typeof value !== "number") return "Checking soon";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatMessageStatus(value?: number) {
  return value ? `Sent ${formatDate(value)}` : "Waiting for trigger";
}

function formatProtocolKey(key?: string, broadLabel = "All protocols") {
  if (!key || key === "all") return broadLabel;
  return key
    .replace(/([a-z])([0-9])/gu, "$1 $2")
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .replace(/[-_]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/\b\w/gu, (char) => char.toUpperCase()) || "Selected protocol";
}

function protocolTitleScope(alert: ManagedAlert) {
  return alert.protocolLabel || formatProtocolKey(alert.protocolKey, "any protocol");
}

function describeAlert(alert: ManagedAlert) {
  const scope = protocolTitleScope(alert);
  if (alert.kind === "apr_above") return `${alert.tokenSymbol} above ${alert.thresholdApr}% APR on ${scope}`;
  if (alert.kind === "apr_below") return `${alert.tokenSymbol} below ${alert.thresholdApr}% APR on ${scope}`;
  if (alert.kind === "best_market_change") return `${alert.tokenSymbol} top displayed place changes on ${scope}`;
  if (alert.kind === "daily_digest") return "Daily DeFi rates digest";
  if (alert.kind === "daily_news_brief") return "Daily latest news brief";
  if (alert.kind === "token_market_new") return alert.tokenSymbol === "ANY" ? "Any new token market" : `New ${alert.tokenSymbol} token market`;
  if (alert.kind === "token_volume_above") return `${alert.tokenSymbol} 24h volume above ${formatUsd(alert.thresholdApr)}`;
  if (alert.kind === "token_liquidity_above") return `${alert.tokenSymbol} liquidity above ${formatUsd(alert.thresholdApr)}`;
  if (alert.kind === "token_price_move") return `${alert.tokenSymbol} 24h move above ${alert.thresholdApr}%`;
  return alert.tokenSymbol === "ANY" ? `Any new displayed market on ${scope}` : `New ${alert.tokenSymbol} market on ${scope}`;
}

function alertConditionTitle(alert: ManagedAlert) {
  return describeAlert(alert);
}

function alertMetricLabel(alert: ManagedAlert) {
  if (alert.kind === "token_volume_above") return "Latest volume";
  if (alert.kind === "token_liquidity_above") return "Latest liquidity";
  if (alert.kind === "token_price_move") return "Latest move";
  if (alert.kind === "token_market_new") return "Known markets";
  return "Current best";
}

function alertMetricValue(alert: ManagedAlert) {
  if (alert.kind === "token_market_new") {
    return typeof alert.lastApr === "number" ? `${alert.lastApr} tracked` : "Checking soon";
  }
  if (alert.kind === "token_volume_above" || alert.kind === "token_liquidity_above") {
    return formatUsd(alert.lastApr);
  }
  if (alert.kind === "token_price_move") {
    return typeof alert.lastApr === "number" ? `${alert.lastApr.toFixed(2)}%` : "Checking soon";
  }
  return formatApr(alert.lastApr);
}

export function AlertManagement() {
  const [connection, setConnection] = useState<StoredTelegramConnection | null>(null);
  const [alerts, setAlerts] = useState<ManagedAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);

  const loadAlerts = useCallback(async (chatId: string) => {
    if (!chatId) return;
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch(`/api/alerts?chatId=${encodeURIComponent(chatId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load alerts.");
      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = readStoredTelegramConnection();
    setConnection(stored);
    if (!stored) {
      setLoading(false);
      return;
    }
    void loadAlerts(stored.chatId);
  }, [loadAlerts]);

  useEffect(() => {
    function handleAlertsChanged() {
      const stored = readStoredTelegramConnection();
      setConnection(stored);
      if (stored) void loadAlerts(stored.chatId);
    }

    window.addEventListener("onchain-pulse:alerts-changed", handleAlertsChanged);
    return () => window.removeEventListener("onchain-pulse:alerts-changed", handleAlertsChanged);
  }, [loadAlerts]);

  async function updateAlert(alert: ManagedAlert, nextStatus: "active" | "paused") {
    if (!connection) return;
    setStatus("");
    try {
      const response = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: alert.id,
          chatId: connection.chatId,
          status: nextStatus,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update alert.");
      setAlerts((current) => current.map((item) => item.id === alert.id ? data.alert : item));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update alert.");
    }
  }

  async function deleteAlert(alert: ManagedAlert) {
    if (!connection) return;
    setStatus("");
    try {
      const response = await fetch("/api/alerts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: alert.id,
          chatId: connection.chatId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete alert.");
      setAlerts((current) => current.filter((item) => item.id !== alert.id));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete alert.");
    }
  }

  async function disconnectTelegram() {
    if (!connection) return;
    const confirmed = window.confirm(
      "Disconnect Telegram from Onchain Pulse? This removes your connected chat and deletes your current Telegram alerts."
    );
    if (!confirmed) return;

    setDisconnecting(true);
    setStatus("");
    try {
      const identity = readStoredTelegramIdentity();
      const response = await fetch("/api/alerts/connect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: connection.chatId,
          loginToken: identity?.loginToken,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not disconnect Telegram.");

      clearStoredTelegramAlertState();
      setConnection(null);
      setAlerts([]);
      setStatus("Telegram disconnected. Existing alerts were removed.");
      window.dispatchEvent(new Event("onchain-pulse:alerts-changed"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not disconnect Telegram.");
    } finally {
      setDisconnecting(false);
    }
  }

  if (!connection) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-5">
        <div className="text-[10px] font-bold uppercase text-[var(--color-accent-primary)]">
          4. Manage alerts
        </div>
        <h2 className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">Your alerts</h2>
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-4 py-5 text-[13px] text-[var(--color-text-muted)]">
          Connect Telegram to manage alerts.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-5">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-accent-primary)]">4. Manage alerts</div>
          <h2 className="mt-2 text-[24px] font-bold text-[var(--color-text-primary)]">Your alerts</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => connection && loadAlerts(connection.chatId)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={disconnectTelegram}
            disabled={disconnecting}
            className="rounded-[var(--radius-md)] border border-[rgba(255,71,87,0.45)] px-3 py-2 text-[12px] font-semibold text-[var(--color-negative)] hover:bg-[rgba(255,71,87,0.08)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {disconnecting ? "Disconnecting..." : "Disconnect Telegram"}
          </button>
        </div>
      </div>

      {status && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
          {status}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)]" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-4 py-6 text-[13px] text-[var(--color-text-muted)]">
          No alerts yet.
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-4 py-4"
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px_auto] xl:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase text-[var(--color-text-dim)]">
                    <span>{KIND_LABELS[alert.kind]}</span>
                    <span className={`rounded-[var(--radius-sm)] px-2 py-1 ${
                      alert.status === "active"
                        ? "bg-[rgba(0,245,204,0.1)] text-[var(--color-positive)]"
                        : "bg-[rgba(255,255,255,0.06)] text-[var(--color-text-dim)]"
                    }`}>
                      {alert.status === "active" ? "Active" : "Paused"}
                    </span>
                  </div>
                  <div className="mt-2 truncate text-[18px] font-bold text-[var(--color-text-primary)]">
                    {alertConditionTitle(alert)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-2 py-1 text-[10px] font-semibold text-[var(--color-text-muted)]">
                      ID {alert.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-3 py-3">
                    <div className="text-[9px] font-bold uppercase text-[var(--color-text-dim)]">
                      {alertMetricLabel(alert)}
                    </div>
                    <div className="mt-1 text-[14px] font-bold text-[var(--color-accent-primary)]">
                      {alertMetricValue(alert)}
                    </div>
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-3 py-3">
                    <div className="text-[9px] font-bold uppercase text-[var(--color-text-dim)]">
                      Message status
                    </div>
                    <div className="mt-1 text-[13px] font-semibold text-[var(--color-text-secondary)]">
                      {formatMessageStatus(alert.lastTriggeredAt)}
                    </div>
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-3 py-3">
                    <div className="text-[9px] font-bold uppercase text-[var(--color-text-dim)]">
                      Created
                    </div>
                    <div className="mt-1 text-[13px] font-semibold text-[var(--color-text-secondary)]">
                      {formatDate(alert.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <button
                    type="button"
                    onClick={() => updateAlert(alert, alert.status === "active" ? "paused" : "active")}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[11px] font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
                  >
                    {alert.status === "active" ? "Pause" : "Resume"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteAlert(alert)}
                    className="rounded-[var(--radius-md)] border border-[rgba(255,71,87,0.45)] px-3 py-2 text-[11px] font-semibold text-[var(--color-negative)] hover:bg-[rgba(255,71,87,0.08)]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
