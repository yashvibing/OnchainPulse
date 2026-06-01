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

function SkeletonCard() {
  return (
    <div className="card card-hover flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="h-5 w-24 animate-pulse rounded-full bg-[rgba(255,255,255,0.05)]" />
        <div className="h-4 w-16 animate-pulse rounded-full bg-[rgba(255,255,255,0.05)]" />
      </div>
      <div className="space-y-2">
        <div className="h-5 w-full animate-pulse rounded bg-[rgba(255,255,255,0.05)]" />
        <div className="h-5 w-5/6 animate-pulse rounded bg-[rgba(255,255,255,0.05)]" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-[rgba(255,255,255,0.04)]" />
        <div className="h-4 w-11/12 animate-pulse rounded bg-[rgba(255,255,255,0.04)]" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-[rgba(255,255,255,0.04)]" />
      </div>
      <div className="mt-auto h-4 w-28 animate-pulse rounded-full bg-[rgba(255,255,255,0.05)]" />
    </div>
  );
}

function getSignalText(topic: string) {
  const normalized = topic.toLowerCase();
  if (normalized.includes("defi")) {
    return "May explain shifts in rates, liquidity, or protocol demand.";
  }
  if (normalized.includes("ecosystem")) {
    return "May affect builder activity, launches, or user attention.";
  }
  return "Useful context before reading portfolio and market data.";
}

function NewsCard({ article }: { article: NewsArticle }) {
  const content = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[var(--color-border)] bg-[rgba(0,245,204,0.06)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-positive)]">
          {article.topic}
        </span>
        <span className="text-[10px] font-semibold text-[var(--color-text-dim)]">
          {article.source} - {formatRelativeTime(article.publishedAt)}
        </span>
      </div>

      <h3 className="text-[15px] font-bold leading-snug text-[var(--color-text-primary)]">
        {article.title}
      </h3>

      <p
        className="text-[12px] leading-relaxed text-[var(--color-text-secondary)]"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 3,
          overflow: "hidden",
        }}
      >
        {article.summary}
      </p>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
        <span className="font-semibold text-[var(--color-text-secondary)]">Why it matters: </span>
        {getSignalText(article.topic)}
      </div>

      {article.link ? (
        <div className="mt-auto flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-muted)]">
          <span>Read the full story</span>
          <span aria-hidden="true">-&gt;</span>
        </div>
      ) : (
        <div className="mt-auto text-[11px] font-semibold text-[var(--color-text-dim)]">
          Added manually
        </div>
      )}
    </>
  );

  if (!article.link) {
    return <div className="card card-hover flex h-full flex-col gap-3 p-4">{content}</div>;
  }

  return (
    <a
      href={article.link}
      target="_blank"
      rel="noreferrer"
      className="card card-hover flex h-full flex-col gap-3 p-4 transition-transform duration-150 hover:-translate-y-0.5"
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
  const displayedItems = items.slice(0, 4);

  return (
    <section className="mt-10 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[rgba(9,15,14,0.9)] p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-caps text-[var(--color-accent-primary)]">
            Curated Market Updates
          </div>
          <h2 className="mt-2 text-[20px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
            Recent context added by your team
          </h2>
          <p className="mt-1 max-w-[760px] text-[12px] leading-relaxed text-[var(--color-text-muted)]">
            A compact feed of submitted Monad, DeFi, and ecosystem updates. Use
            it as context after checking wallets and rates, not as financial advice.
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : items.length > 0 ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {displayedItems.map((article) => (
              <NewsCard key={article.id || article.link || article.title} article={article} />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-dim)]">
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
