"use client";

import { FormEvent, useMemo, useState } from "react";

const categories = [
  { value: "security", label: "Security" },
  { value: "protocol", label: "Protocol" },
  { value: "launch", label: "Launch" },
  { value: "rates", label: "Rates" },
  { value: "other", label: "Other" },
];

const emptyForm = {
  url: "",
  text: "",
  category: "security",
};

export function NewsTipSubmitForm() {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return form.url.trim().length > 0 && form.text.trim().length >= 10 && !submitting;
  }, [form, submitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/news/tips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);

      setForm(emptyForm);
      setMessage("Sent for review.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit update.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[rgba(9,15,14,0.9)] p-4 md:p-5">
      <div className="grid gap-5">
        <div>
          <div className="label-caps text-[var(--color-accent-primary)]">Submit an update</div>
          <h2 className="mt-2 text-[22px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
            Found something important?
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            Send an X post and short context. It goes to review before news or Telegram.
          </p>
        </div>

        <form className="grid gap-3" onSubmit={handleSubmit}>
          <div className="grid gap-3">
            <input
              type="url"
              value={form.url}
              onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
              placeholder="https://x.com/.../status/..."
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-3 text-[14px] font-semibold text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-primary)]"
            />
            <select
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-3 text-[14px] font-semibold text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent-primary)]"
            >
              {categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={form.text}
            onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))}
            placeholder="Why should this be reviewed?"
            rows={3}
            className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-3 text-[14px] font-semibold leading-relaxed text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-primary)]"
          />

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

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-4 py-3 text-[13px] font-bold text-[#07110C] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting ? "Sending..." : "Send for review"}
          </button>
        </form>
      </div>
    </section>
  );
}
