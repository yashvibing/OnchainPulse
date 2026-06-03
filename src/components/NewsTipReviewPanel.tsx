"use client";

import { useCallback, useEffect, useState } from "react";
import type { NewsTip } from "@/lib/newsTips";

interface TipsResponse {
  ok: boolean;
  tips?: NewsTip[];
  sent?: number;
  error?: string;
}

function formatTime(value: number) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(tip: NewsTip) {
  const states = [];
  if (tip.publishedAt) states.push("Added to news");
  if (tip.sentAt) states.push("Sent to Telegram");
  return states.join(" / ") || "Pending";
}

export function NewsTipReviewPanel() {
  const [tips, setTips] = useState<NewsTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/news/tips", { credentials: "same-origin" });
      const data = await response.json() as TipsResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setTips(data.tips || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load submitted updates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTips();
  }, [loadTips]);

  async function reviewTip(id: string, action: "publish" | "broadcast" | "dismiss") {
    setBusyId(id);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/news/tips", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id, action }),
      });
      const data = await response.json() as TipsResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);

      if (action === "broadcast") {
        setMessage(`Telegram sent to ${data.sent || 0} connected chats.`);
      } else if (action === "publish") {
        setMessage("Added to Latest News.");
      } else {
        setMessage("Dismissed.");
      }
      await loadTips();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update tip.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[rgba(9,15,14,0.9)] p-4 md:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label-caps text-[var(--color-accent-primary)]">Submitted Updates</div>
          <h2 className="mt-2 text-[24px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
            Review community tips
          </h2>
          <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            Publish useful links to Latest News or send urgent ones to Telegram.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadTips()}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-[13px] font-bold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-[var(--radius-md)] border border-[rgba(255,88,88,0.35)] bg-[rgba(255,88,88,0.08)] px-3 py-2 text-[12px] font-semibold text-[var(--color-danger)]">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-3 rounded-[var(--radius-md)] border border-[rgba(0,245,204,0.35)] bg-[rgba(0,245,204,0.08)] px-3 py-2 text-[12px] font-semibold text-[var(--color-positive)]">
          {message}
        </div>
      )}

      {loading ? (
        <div className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-[rgba(255,255,255,0.04)]" />
      ) : tips.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 text-[13px] font-semibold text-[var(--color-text-muted)]">
          No submitted updates waiting for review.
        </div>
      ) : (
        <div className="grid gap-3">
          {tips.map((tip) => (
            <article
              key={tip.id}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-[var(--radius-sm)] bg-[rgba(0,245,204,0.08)] px-2 py-1 text-[11px] font-black uppercase text-[var(--color-accent-primary)]">
                  {tip.category}
                </span>
                <a
                  href={tip.sourceProfileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-accent-primary)]"
                >
                  {tip.sourceHandle}
                </a>
                <span className="text-[12px] text-[var(--color-text-dim)]">
                  {formatTime(tip.submittedAt)}
                </span>
                <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">
                  {statusLabel(tip)}
                </span>
              </div>

              <p className="mt-3 text-[15px] font-semibold leading-relaxed text-[var(--color-text-primary)]">
                {tip.text}
              </p>
              <a
                href={tip.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block break-all text-[12px] font-semibold text-[var(--color-text-muted)] underline decoration-dotted underline-offset-4 hover:text-[var(--color-accent-primary)]"
              >
                {tip.url}
              </a>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={Boolean(tip.publishedAt) || busyId === tip.id}
                  onClick={() => void reviewTip(tip.id, "publish")}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[12px] font-bold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add to news
                </button>
                <button
                  type="button"
                  disabled={Boolean(tip.sentAt) || busyId === tip.id}
                  onClick={() => void reviewTip(tip.id, "broadcast")}
                  className="rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-3 py-2 text-[12px] font-bold text-[#07110C] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Send Telegram
                </button>
                <button
                  type="button"
                  disabled={busyId === tip.id}
                  onClick={() => void reviewTip(tip.id, "dismiss")}
                  className="rounded-[var(--radius-md)] border border-[rgba(255,88,88,0.45)] px-3 py-2 text-[12px] font-bold text-[var(--color-danger)] transition-colors hover:bg-[rgba(255,88,88,0.08)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Dismiss
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
