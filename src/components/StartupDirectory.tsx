"use client";

import { useMemo, useState } from "react";
import {
  DELTAV_BASE_URL,
  DELTAV_STARTUPS,
  type DeltavStartup,
} from "@/data/deltavStartups";

function getFeedbackUrl(startup: DeltavStartup) {
  return `${DELTAV_BASE_URL}/feedback/${startup.feedbackId}`;
}

function metricLabel(value?: number) {
  if (typeof value !== "number") return "0";
  return new Intl.NumberFormat("en-US").format(value);
}

function StartupInitial({ startup }: { startup: DeltavStartup }) {
  const initials = startup.name
    .split(/[\s/-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[rgba(56,189,248,0.22)] bg-[linear-gradient(135deg,rgba(37,240,156,0.14),rgba(56,189,248,0.12),rgba(185,156,255,0.16))] text-[12px] font-black text-[var(--color-text-primary)]"
      aria-hidden="true"
    >
      {initials || "DV"}
    </div>
  );
}

function StartupCard({ startup }: { startup: DeltavStartup }) {
  return (
    <article className="card card-hover flex min-h-[250px] flex-col p-4">
      <div className="flex items-start gap-3">
        <StartupInitial startup={startup} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-bold text-[var(--color-text-primary)]">
                {startup.name}
              </h2>
              <p className="mt-1 truncate text-[12px] text-[var(--color-text-muted)]">
                {startup.founder || "Founder/team"}
              </p>
            </div>
            <span className="rounded-[var(--radius-sm)] bg-[rgba(185,156,255,0.13)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--color-accent-violet)]">
              {startup.category}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-4 line-clamp-3 min-h-[62px] text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
        {startup.description || "Public startup listing from DeltaV."}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 border-y border-[var(--color-border)] py-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-dim)]">
            Page
          </div>
          <div className="mt-1 font-mono text-[13px] text-[var(--color-text-primary)]">
            {startup.sourcePage}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-dim)]">
            Believers
          </div>
          <div className="mt-1 font-mono text-[13px] text-[var(--color-text-primary)]">
            {metricLabel(startup.believers)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-dim)]">
            Followers
          </div>
          <div className="mt-1 font-mono text-[13px] text-[var(--color-text-primary)]">
            {metricLabel(startup.followers)}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <a
          href={getFeedbackUrl(startup)}
          className="block rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-3 py-2 text-center text-[12px] font-black text-[#07110C] transition-opacity hover:opacity-90"
        >
          Give Feedback on DeltaV
        </a>
      </div>
    </article>
  );
}

export function StartupDirectory() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(DELTAV_STARTUPS.map((startup) => startup.category))).sort()],
    [],
  );

  const filteredStartups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return DELTAV_STARTUPS.filter((startup) => {
      const matchesCategory = category === "All" || startup.category === category;
      const haystack = `${startup.name} ${startup.category} ${startup.founder} ${startup.description}`.toLowerCase();
      return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [category, query]);

  return (
    <section className="space-y-5">
      <div className="card-elevated p-4 sm:p-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-accent-secondary)]">
          DeltaV public listings
        </div>
        <h1 className="mt-2 text-[28px] font-bold text-[var(--color-text-primary)]">
          Startup Feedback
        </h1>
        <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-[var(--color-text-muted)]">
          Browse public DeltaV startup listings. Each feedback link opens the
          relevant DeltaV feedback page for that startup.
        </p>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block lg:w-[420px]">
            <span className="sr-only">Search startups</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by startup, founder, category, or summary"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-4 py-3 text-[13px] text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-border-hover)]"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-[var(--radius-md)] border px-3 py-2 text-[11px] font-bold transition-colors ${
                  category === item
                    ? "border-[rgba(37,240,156,0.36)] bg-[rgba(37,240,156,0.13)] text-[var(--color-accent-primary)]"
                    : "border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 text-[12px] text-[var(--color-text-muted)]">
          Showing {filteredStartups.length} of {DELTAV_STARTUPS.length} startup listings.
        </div>
      </div>

      {filteredStartups.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredStartups.map((startup) => (
            <StartupCard key={startup.slug} startup={startup} />
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <h2 className="text-[18px] font-bold text-[var(--color-text-primary)]">
            No startups found
          </h2>
          <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
            Try a different search term or category.
          </p>
        </div>
      )}
    </section>
  );
}
