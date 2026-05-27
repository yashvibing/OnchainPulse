"use client";

import { useCallback, useEffect, useState } from "react";
import { readStoredTelegramConnection, type StoredTelegramConnection } from "@/lib/telegramAlertClient";

type AlertKind = "apr_above" | "apr_below" | "best_market_change" | "new_market" | "daily_digest";

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
  daily_digest: "Daily digest",
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

function formatMessageStatus(value?: number) {
  return value ? `Sent ${formatDate(value)}` : "Waiting for trigger";
}

function formatProtocolKey(key?: string) {
  if (!key || key === "all") return "All protocols";
  return key
    .replace(/([a-z])([0-9])/gu, "$1 $2")
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .replace(/[-_]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/\b\w/gu, (char) => char.toUpperCase()) || "Selected protocol";
}

function protocolScope(alert: ManagedAlert) {
  return alert.protocolLabel || formatProtocolKey(alert.protocolKey);
}

function describeAlert(alert: ManagedAlert) {
  const scope = protocolScope(alert);
  if (alert.kind === "apr_above") return `${alert.tokenSymbol} above ${alert.thresholdApr}% APR on ${scope}`;
  if (alert.kind === "apr_below") return `${alert.tokenSymbol} below ${alert.thresholdApr}% APR on ${scope}`;
  if (alert.kind === "best_market_change") return `${alert.tokenSymbol} top displayed place changes on ${scope}`;
  if (alert.kind === "daily_digest") return `${alert.tokenSymbol === "ANY" ? "All watched markets" : alert.tokenSymbol} daily top rates on ${scope}`;
  return alert.tokenSymbol === "ANY" ? `Any new displayed market on ${scope}` : `New ${alert.tokenSymbol} market on ${scope}`;
}

function alertConditionTitle(alert: ManagedAlert) {
  if (alert.kind === "apr_above") return `${alert.tokenSymbol} above ${alert.thresholdApr}% APR`;
  if (alert.kind === "apr_below") return `${alert.tokenSymbol} below ${alert.thresholdApr}% APR`;
  if (alert.kind === "best_market_change") return `${alert.tokenSymbol} best place changes`;
  if (alert.kind === "daily_digest") return `${alert.tokenSymbol === "ANY" ? "All markets" : alert.tokenSymbol} rate digest`;
  return alert.tokenSymbol === "ANY" ? "Any new market" : `New ${alert.tokenSymbol} market`;
}

export function AlertManagement() {
  const [connection, setConnection] = useState<StoredTelegramConnection | null>(null);
  const [alerts, setAlerts] = useState<ManagedAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

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

  if (!connection) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-5">
        <div className="text-[10px] font-bold uppercase text-[var(--color-accent-primary)]">
          3. Manage alerts
        </div>
        <h2 className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">Your alerts</h2>
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-4 py-5 text-[13px] text-[var(--color-text-muted)]">
          Connect Telegram above to see, pause, resume, or delete your alerts here.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-5">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-accent-primary)]">3. Manage alerts</div>
          <h2 className="mt-2 text-[24px] font-bold text-[var(--color-text-primary)]">Your alerts</h2>
          <p className="mt-1 max-w-[700px] text-[12px] leading-relaxed text-[var(--color-text-muted)]">
            Pause alerts when you do not need messages, resume them later, or remove old watches completely.
          </p>
        </div>
        <button
          type="button"
          onClick={() => connection && loadAlerts(connection.chatId)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
        >
          Refresh
        </button>
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
          No alerts yet. Use the alert creator above to make your first watch.
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
                    <span className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[rgba(0,245,204,0.06)] px-2 py-1 text-[10px] font-semibold text-[var(--color-text-secondary)]">
                      Scope: {protocolScope(alert)}
                    </span>
                    <span className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-2 py-1 text-[10px] font-semibold text-[var(--color-text-muted)]">
                      ID {alert.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-3 py-3">
                    <div className="text-[9px] font-bold uppercase text-[var(--color-text-dim)]">
                      Current best
                    </div>
                    <div className="mt-1 text-[14px] font-bold text-[var(--color-accent-primary)]">
                      {formatApr(alert.lastApr)}
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
              <div className="mt-3 border-t border-[var(--color-border)] pt-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                {describeAlert(alert)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
