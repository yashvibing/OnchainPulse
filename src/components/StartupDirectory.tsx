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
      className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface-solid)] font-mono text-[20px] font-black text-[var(--color-accent-primary)]"
      aria-hidden="true"
    >
      {initials || "DV"}
      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-tl-[var(--radius-sm)] bg-[var(--color-accent-primary)]" />
    </div>
  );
}

function StartupCard({ startup }: { startup: DeltavStartup }) {
  return (
    <article className="card card-hover flex min-h-[300px] min-w-0 max-w-full flex-col border-t-4 border-t-[var(--color-accent-primary)] p-4">
      <div className="flex min-w-0 items-start gap-3">
        <StartupInitial startup={startup} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[20px] font-bold text-[var(--color-text-primary)]">
                {startup.name}
              </h2>
              <p className="mt-1 truncate font-mono text-[13px] text-[var(--color-text-muted)]">
                {startup.founder || "Founder/team"}
              </p>
            </div>
            <span className="label-caps max-w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-surface-solid)] px-2 py-1 text-[var(--color-text-secondary)]">
              {startup.category}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-5 line-clamp-4 min-h-[82px] text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
        {startup.description || "Public startup listing from DeltaV."}
      </p>

      <div className="mt-5 grid min-w-0 grid-cols-2 gap-2 border-y border-[var(--color-border)] bg-[rgba(8,16,13,0.42)] py-3">
        <div className="min-w-0 border-r border-[var(--color-border)] text-center">
          <div className="label-caps text-[var(--color-text-muted)]">
            Believers
          </div>
          <div className="mt-2 font-mono text-[18px] font-semibold text-[var(--color-text-primary)]">
            {metricLabel(startup.believers)}
          </div>
        </div>
        <div className="min-w-0 text-center">
          <div className="label-caps text-[var(--color-text-muted)]">
            Followers
          </div>
          <div className="mt-2 font-mono text-[18px] font-semibold text-[var(--color-text-primary)]">
            {metricLabel(startup.followers)}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <a
          href={getFeedbackUrl(startup)}
          className="btn-primary block min-h-10 px-3 py-2 text-center text-[11px]"
        >
          Give Feedback on DeltaV ↗
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
    <section className="space-y-6">
      <div className="border-b border-[var(--color-border)] pb-8 pt-2">
        <div className="label-caps text-[var(--color-accent-primary)]">
          DeltaV public listings
        </div>
        <h1 className="mt-3 text-[40px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
          Ecosystem
        </h1>
        <p className="mt-3 max-w-[760px] text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
          Browse DeltaV listings and open DeltaV to leave feedback.
        </p>
      </div>

      <div className="card bg-[var(--color-bg-card-hover)] p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block lg:w-[420px]">
            <span className="sr-only">Search startups</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by startup, founder, category, or summary"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface-solid)] px-4 py-3 font-mono text-[13px] text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-primary)]"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`label-caps rounded-[var(--radius-md)] border px-3 py-2 transition-colors ${
                  category === item
                    ? "border-[var(--color-accent-primary)] bg-[rgba(0,245,204,0.1)] text-[var(--color-accent-primary)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg-surface-solid)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
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
