"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LatestNewsPayload, NewsArticle } from "@/lib/news";

interface NewsApiResponse extends LatestNewsPayload {
  ok: boolean;
  status: "hit" | "miss" | "stale" | "error";
  fetchedAt: number;
  ageMs?: number;
  durationMs?: number;
  error?: string;
  cache?: {
    backend: "redis" | "memory";
  };
}

function formatRelativeTime(value: string | number) {
  const date = new Date(value);
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (abs < 60) return rtf.format(-diffSeconds, "second");
  if (abs < 3600) return rtf.format(-Math.round(diffSeconds / 60), "minute");
  if (abs < 86_400) return rtf.format(-Math.round(diffSeconds / 3600), "hour");
  return rtf.format(-Math.round(diffSeconds / 86_400), "day");
}

function clampText(value: string, maxLength: number) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  const cut = cleaned.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 48 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
}

function cleanNewsText(value: string) {
  return value
    .replace(/https?:\/\/\S+/giu, "")
    .replace(/@([a-z0-9_]{2,})/giu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value: string) {
  return cleanNewsText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function sourceLabel(article: NewsArticle) {
  const source = article.source
    .replace(/^source:\s*/iu, "")
    .replace(/^x\s*\/\s*@?/iu, "")
    .replace(/^@/u, "")
    .trim();

  if (source && source.toLowerCase() !== "manual") return clampText(source, 24);

  try {
    const url = new URL(article.link);
    const [, handle] = url.pathname.split("/");
    if ((url.hostname === "x.com" || url.hostname === "twitter.com") && handle) {
      return clampText(handle.replace(/_/gu, " "), 24);
    }
    return clampText(url.hostname.replace(/^www\./u, ""), 24);
  } catch {
    return "Curated";
  }
}

function SkeletonCard() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-5 w-20 animate-pulse rounded-full bg-[rgba(255,255,255,0.05)]" />
        <div className="h-4 w-28 animate-pulse rounded-full bg-[rgba(255,255,255,0.04)]" />
      </div>
      <div className="space-y-2">
        <div className="h-5 w-11/12 animate-pulse rounded bg-[rgba(255,255,255,0.05)]" />
        <div className="h-5 w-2/3 animate-pulse rounded bg-[rgba(255,255,255,0.05)]" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-[rgba(255,255,255,0.04)]" />
      </div>
    </div>
  );
}

function NewsCard({ article }: { article: NewsArticle }) {
  const title = clampText(cleanNewsText(article.title), 132);
  const summary = clampText(cleanNewsText(article.summary), 180);
  const titleKey = normalizeText(title);
  const summaryKey = normalizeText(summary);
  const hasSummary = Boolean(summary && summaryKey !== titleKey && !summaryKey.startsWith(titleKey));
  const source = sourceLabel(article);
  const meta = `${source} - ${formatRelativeTime(article.publishedAt)}`;
  const content = (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="rounded-full border border-[rgba(0,245,204,0.22)] bg-[rgba(0,245,204,0.07)] px-2.5 py-1 text-[10px] font-bold uppercase text-[var(--color-positive)]">
          {article.topic}
        </span>
        <span className="min-w-0 truncate text-[11px] font-semibold text-[var(--color-text-dim)]">
          {meta}
        </span>
      </div>

      <h3 className="mt-3 text-[16px] font-bold leading-snug text-[var(--color-text-primary)]">
        {title || source}
      </h3>

      {hasSummary && (
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          {summary}
        </p>
      )}

      {article.link ? (
        <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-[var(--color-accent-primary)]">
          <span>Open source</span>
          <span aria-hidden="true">-&gt;</span>
        </div>
      ) : (
        <div className="mt-4 text-[11px] font-semibold text-[var(--color-text-dim)]">
          Added manually
        </div>
      )}
    </>
  );

  if (!article.link) {
    return (
      <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] p-4">
        {content}
      </article>
    );
  }

  return (
    <a
      href={article.link}
      target="_blank"
      rel="noreferrer"
      className="block rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] p-4 transition-colors hover:border-[var(--color-border-hover)] hover:bg-[rgba(255,255,255,0.04)]"
    >
      {content}
    </a>
  );
}

export function LatestNewsSection() {
  const [items, setItems] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<NewsApiResponse | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const loadNews = useCallback((silentRefresh = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    if (silentRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);

    fetch("/api/news", { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as NewsApiResponse;
        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        setItems(data.items || []);
        setMeta(data);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Failed to load news.";
        setError(message);
        setItems([]);
        setMeta(null);
      })
      .finally(() => {
        if (requestRef.current === controller) {
          setLoading(false);
          setRefreshing(false);
        }
      });
  }, []);

  useEffect(() => {
    loadNews();
    return () => {
      requestRef.current?.abort();
    };
  }, [loadNews]);

  const fetchedAt = meta?.fetchedAt || meta?.generatedAt || 0;
  const freshnessLabel = fetchedAt ? formatRelativeTime(fetchedAt) : null;
  const displayedItems = items.slice(0, 5);

  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[rgba(9,15,14,0.92)] p-4 md:p-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-caps text-[var(--color-accent-primary)]">
            Market Updates
          </div>
          <h2 className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">
            Curated signal feed
          </h2>
          <p className="mt-1 max-w-[680px] text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            Cleaned-up Monad and DeFi updates for quick scanning.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {freshnessLabel && (
            <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
              Updated {freshnessLabel}
            </span>
          )}
          <button
            type="button"
            onClick={() => loadNews(true)}
            disabled={loading || refreshing}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[11px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {refreshing ? "Refreshing..." : "Refresh feed"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : items.length > 0 ? (
        <>
          <div className="grid gap-3">
            {displayedItems.map((article) => (
              <NewsCard key={article.id || article.link || article.title} article={article} />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3 text-[11px] text-[var(--color-text-dim)]">
            <span>Showing {displayedItems.length} curated updates.</span>
          </div>
        </>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-4 py-5">
          <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">
            {error ? "News is temporarily unavailable." : "No curated news yet."}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
            Curated updates will appear here after they are submitted.
          </p>
        </div>
      )}
    </section>
  );
}
