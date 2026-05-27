"use client";

import { useCallback, useEffect, useState } from "react";
import { readStoredTelegramConnection, type StoredTelegramConnection } from "@/lib/telegramAlertClient";

type AlertKind = "apr_above" | "apr_below" | "best_market_change" | "new_market" | "daily_digest";

interface ManagedAlert {
  id: string;
  kind: AlertKind;
  tokenSymbol: string;
  protocolKey?: string;
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
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describeAlert(alert: ManagedAlert) {
  if (alert.kind === "apr_above") return `${alert.tokenSymbol} above ${alert.thresholdApr}% APR`;
  if (alert.kind === "apr_below") return `${alert.tokenSymbol} below ${alert.thresholdApr}% APR`;
  if (alert.kind === "best_market_change") return `${alert.tokenSymbol} top displayed place changes`;
  if (alert.kind === "daily_digest") return `${alert.tokenSymbol === "ANY" ? "All watched markets" : alert.tokenSymbol} daily top rates`;
  return alert.tokenSymbol === "ANY" ? "Any new displayed market" : `New ${alert.tokenSymbol} market`;
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
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-8">
        <h2 className="text-[22px] font-bold text-[var(--color-text-primary)]">Connect Telegram first</h2>
        <p className="mt-2 max-w-[680px] text-[13px] leading-relaxed text-[var(--color-text-muted)]">
          Use the alert creator above, tap Start in Telegram, then return here to manage alerts.
        </p>
        <a
          href="#create-alert"
          className="mt-5 inline-flex rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-4 py-2 text-[12px] font-bold text-[#07110C]"
        >
          Create Telegram link
        </a>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-5">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[12px] font-bold uppercase text-[var(--color-accent-primary)]">Telegram Alert Management</div>
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
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-bold text-[var(--color-text-primary)]">{KIND_LABELS[alert.kind]}</span>
                    <span className={`rounded-[var(--radius-sm)] px-2 py-1 text-[9px] font-bold uppercase ${
                      alert.status === "active"
                        ? "bg-[rgba(0,245,204,0.1)] text-[var(--color-positive)]"
                        : "bg-[rgba(255,255,255,0.06)] text-[var(--color-text-dim)]"
                    }`}>
                      {alert.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{describeAlert(alert)}</div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-[var(--color-text-dim)]">
                    <span>ID {alert.id.slice(0, 8)}</span>
                    <span>Created {formatDate(alert.createdAt)}</span>
                    <span>Last sent {formatDate(alert.lastTriggeredAt)}</span>
                    {typeof alert.lastApr === "number" && <span>Last seen {alert.lastApr.toFixed(2)}% APR</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
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
