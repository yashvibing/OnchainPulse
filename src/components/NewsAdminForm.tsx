"use client";

import { FormEvent, useMemo, useState } from "react";
import type { NewsArticle } from "@/lib/news";

interface SubmitResponse {
  ok: boolean;
  item?: NewsArticle;
  error?: string;
}

const emptyForm = {
  url: "",
  title: "",
  summary: "",
  topic: "Monad",
  source: "",
  publishedAt: "",
};

function cleanPayload(form: typeof emptyForm) {
  return Object.fromEntries(
    Object.entries({
      url: form.url,
      title: form.title,
      summary: form.summary,
      topic: form.topic,
      source: form.source,
      publishedAt: form.publishedAt,
    }).filter(([, value]) => value.trim().length > 0)
  );
}

export function NewsAdminForm() {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastItem, setLastItem] = useState<NewsArticle | null>(null);

  const canSubmit = useMemo(() => {
    const hasContent =
      form.url.trim().length > 0 ||
      form.title.trim().length > 0 ||
      form.summary.trim().length > 0;
    return hasContent && !submitting;
  }, [form, submitting]);

  function updateField(name: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setMessage(null);
    setError(null);
    setLastItem(null);

    try {
      const response = await fetch("/api/news/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(cleanPayload(form)),
      });
      const data = (await response.json()) as SubmitResponse;
      if (!response.ok || !data.ok || !data.item) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setLastItem(data.item);
      setMessage("News added. It should appear in the feed now.");
      setForm((current) => ({
        ...emptyForm,
        topic: current.topic || "Monad",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit news.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[rgba(9,15,14,0.9)] p-4 md:p-5">
      <div className="mb-5">
        <div className="label-caps text-[var(--color-accent-primary)]">News Admin</div>
        <h2 className="mt-2 text-[24px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
          Add a curated update
        </h2>
        <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-[var(--color-text-muted)]">
          Paste an article link, write your own update, or do both. The feed
          only uses submitted items, so no outside headlines are auto-filled.
        </p>
      </div>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2">
            <span className="label-caps text-[var(--color-text-muted)]">Article URL</span>
            <input
              type="url"
              value={form.url}
              onChange={(event) => updateField("url", event.target.value)}
              placeholder="https://..."
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-3 text-[14px] font-semibold text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-primary)]"
            />
          </label>

          <label className="grid gap-2">
            <span className="label-caps text-[var(--color-text-muted)]">Topic</span>
            <input
              value={form.topic}
              onChange={(event) => updateField("topic", event.target.value)}
              placeholder="Monad, DeFi, Ecosystem..."
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-3 text-[14px] font-semibold text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-primary)]"
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2">
            <span className="label-caps text-[var(--color-text-muted)]">Title</span>
            <input
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Optional when URL metadata is readable"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-3 text-[14px] font-semibold text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-primary)]"
            />
          </label>

          <label className="grid gap-2">
            <span className="label-caps text-[var(--color-text-muted)]">Source</span>
            <input
              value={form.source}
              onChange={(event) => updateField("source", event.target.value)}
              placeholder="Optional"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-3 text-[14px] font-semibold text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-primary)]"
            />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="label-caps text-[var(--color-text-muted)]">Summary or text</span>
          <textarea
            value={form.summary}
            onChange={(event) => updateField("summary", event.target.value)}
            placeholder="Write the short version you want displayed..."
            rows={5}
            className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-3 text-[14px] font-semibold leading-relaxed text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-primary)]"
          />
        </label>

        <label className="grid gap-2">
          <span className="label-caps text-[var(--color-text-muted)]">
            Published at (optional)
          </span>
          <input
            type="datetime-local"
            value={form.publishedAt}
            onChange={(event) => updateField("publishedAt", event.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-3 text-[14px] font-semibold text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent-primary)]"
          />
          <span className="text-[12px] font-medium text-[var(--color-text-dim)]">
            Leave blank to publish immediately.
          </span>
        </label>

        {error && (
          <div className="rounded-[var(--radius-md)] border border-[rgba(255,88,88,0.35)] bg-[rgba(255,88,88,0.08)] px-3 py-2 text-[12px] font-semibold text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-[var(--radius-md)] border border-[rgba(0,245,204,0.35)] bg-[rgba(0,245,204,0.08)] px-3 py-2 text-[12px] font-semibold text-[var(--color-positive)]">
            {message}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-4 py-3 text-[13px] font-bold text-[#07110C] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting ? "Adding..." : "Add news"}
          </button>
          <a
            href="/news"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-[13px] font-bold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
          >
            View feed
          </a>
        </div>
      </form>

      {lastItem && (
        <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] p-4">
          <div className="label-caps text-[var(--color-text-muted)]">Last added</div>
          <div className="mt-2 text-[16px] font-bold text-[var(--color-text-primary)]">
            {lastItem.title}
          </div>
          <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">
            {lastItem.topic} - {lastItem.source}
          </div>
        </div>
      )}
    </section>
  );
}
