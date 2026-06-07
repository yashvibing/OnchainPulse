"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readStoredTelegramConnection,
  type StoredTelegramConnection,
} from "@/lib/telegramAlertClient";

interface TelegramNotificationPreferences {
  defiRateAlerts: boolean;
  dailyDefiBrief: boolean;
  latestNewsBrief: boolean;
  ecosystemUpdates: boolean;
  securityUpdates: boolean;
}

type PreferenceKey = keyof TelegramNotificationPreferences;

const PREFERENCE_ITEMS: Array<{
  key: PreferenceKey;
  title: string;
  description: string;
}> = [
  {
    key: "defiRateAlerts",
    title: "DeFi rate alerts",
    description: "APR thresholds, best-place changes, and new market watches.",
  },
  {
    key: "dailyDefiBrief",
    title: "Weekly DeFi rates brief",
    description: "Weekly Telegram summary for displayed DeFi rates.",
  },
  {
    key: "securityUpdates",
    title: "Security updates",
    description: "Important security-related Telegram notices.",
  },
];

const DEFAULT_PREFERENCES: TelegramNotificationPreferences = {
  defiRateAlerts: true,
  dailyDefiBrief: true,
  latestNewsBrief: true,
  ecosystemUpdates: true,
  securityUpdates: true,
};

function ToggleButton({
  enabled,
  disabled,
  onClick,
}: {
  enabled: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 w-12 items-center rounded-full border px-1 transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        enabled
          ? "justify-end border-[var(--color-accent-primary)] bg-[rgba(0,245,204,0.18)]"
          : "justify-start border-[var(--color-border)] bg-[rgba(255,255,255,0.035)]"
      }`}
    >
      <span
        className={`h-5 w-5 rounded-full transition-colors ${
          enabled ? "bg-[var(--color-accent-primary)]" : "bg-[var(--color-text-dim)]"
        }`}
      />
    </button>
  );
}

export function AlertPreferences() {
  const [connection, setConnection] = useState<StoredTelegramConnection | null>(null);
  const [preferences, setPreferences] = useState<TelegramNotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<PreferenceKey | null>(null);
  const [status, setStatus] = useState("");

  const loadPreferences = useCallback(async (chatId: string) => {
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch(`/api/alerts/preferences?chatId=${encodeURIComponent(chatId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load message settings.");
      setPreferences({ ...DEFAULT_PREFERENCES, ...(data.preferences || {}) });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load message settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = readStoredTelegramConnection();
    setConnection(stored);
    if (stored) void loadPreferences(stored.chatId);
  }, [loadPreferences]);

  useEffect(() => {
    function handleAlertsChanged() {
      const stored = readStoredTelegramConnection();
      setConnection(stored);
      if (stored) void loadPreferences(stored.chatId);
    }

    window.addEventListener("onchain-pulse:alerts-changed", handleAlertsChanged);
    return () => window.removeEventListener("onchain-pulse:alerts-changed", handleAlertsChanged);
  }, [loadPreferences]);

  async function updatePreference(key: PreferenceKey, enabled: boolean) {
    if (!connection) return;
    const previous = preferences;
    const next = { ...preferences, [key]: enabled };
    setPreferences(next);
    setSavingKey(key);
    setStatus("");

    try {
      const response = await fetch("/api/alerts/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: connection.chatId,
          preferences: { [key]: enabled },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save message setting.");
      setPreferences({ ...DEFAULT_PREFERENCES, ...(data.preferences || {}) });
    } catch (error) {
      setPreferences(previous);
      setStatus(error instanceof Error ? error.message : "Could not save message setting.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <section className="mb-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-5">
      <div className="mb-5">
        <div className="text-[10px] font-bold uppercase text-[var(--color-accent-primary)]">
          3. Message settings
        </div>
        <h2 className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">
          Telegram categories
        </h2>
        <p className="mt-1 max-w-[760px] text-[12px] leading-relaxed text-[var(--color-text-muted)]">
          Choose which private bot messages this chat can receive.
        </p>
      </div>

      {!connection ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-4 py-5 text-[13px] text-[var(--color-text-muted)]">
          Connect Telegram to manage message settings.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {PREFERENCE_ITEMS.map((item) => {
            const enabled = Boolean(preferences[item.key]);
            return (
              <div
                key={item.key}
                className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-4 py-4"
              >
                <div>
                  <div className="text-[14px] font-bold text-[var(--color-text-primary)]">
                    {item.title}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
                    {item.description}
                  </p>
                </div>
                <ToggleButton
                  enabled={enabled}
                  disabled={loading || savingKey === item.key}
                  onClick={() => updatePreference(item.key, !enabled)}
                />
              </div>
            );
          })}
        </div>
      )}

      {status && (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[rgba(255,184,0,0.45)] bg-[rgba(255,184,0,0.08)] px-3 py-2 text-[11px] text-[var(--color-warning)]">
          {status}
        </div>
      )}
    </section>
  );
}
