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

const KNOWN_HANDLES: Record<string, string> = {
  monad: "Monad",
  monad_eco: "Monad Eco",
  deltav_xyz: "DeltaV",
  pendle_fi: "Pendle",
  blend_money: "Blend Money",
  portal_hq: "Portal HQ",
  branchlesspay: "BranchlessPay",
  leverup_xyz: "LeverUp",
  mannyornothing: "Manny",
};

function titleCaseWord(value: string) {
  if (!value) return value;
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function formatHandle(handle: string) {
  const normalized = handle.replace(/^@/u, "").toLowerCase();
  const known = KNOWN_HANDLES[normalized];
  if (known) return known;

  return normalized
    .split(/[\s_-]+/u)
    .filter(Boolean)
    .map((part) => {
      if (part === "fi") return "Fi";
      if (part === "hq") return "HQ";
      if (part === "xyz") return "XYZ";
      return titleCaseWord(part);
    })
    .join(" ");
}

function cleanNewsText(value: string) {
  return value
    .replace(/https?:\/\/\S+/giu, "")
    .replace(/@([a-z0-9_]{2,})/giu, (_, handle: string) => formatHandle(handle))
    .replace(/\bJUST IN:\s*/giu, "")
    .replace(/^[a-z0-9_ ]{2,28}:\s*/iu, "")
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

  if (source && source.toLowerCase() !== "manual") return clampText(formatHandle(source), 24);

  try {
    const url = new URL(article.link);
    const [, handle] = url.pathname.split("/");
    if ((url.hostname === "x.com" || url.hostname === "twitter.com") && handle) {
      return clampText(formatHandle(handle), 24);
    }
    return clampText(url.hostname.replace(/^www\./u, ""), 24);
  } catch {
    return "Curated";
  }
}

function extractHandleNames(value: string) {
  const handles = value.match(/@([a-z0-9_]{2,})/giu) || [];
  return [...new Set(handles.map(formatHandle))];
}

function firstSentence(value: string) {
  const cleaned = cleanNewsText(value).replace(/\s+\.\.\.$/u, "").trim();
  const [sentence] = cleaned.split(/(?<=[.!?])\s+/u);
  return sentence || cleaned;
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function buildReadableBrief(article: NewsArticle) {
  const raw = `${article.title}. ${article.summary}`;
  const lower = raw.toLowerCase();
  const names = extractHandleNames(raw);
  const primaryName = names.find((name) => !["Monad", "Monad Eco", "DeltaV"].includes(name)) || names[0];
  const readable = firstSentence(article.summary || article.title);

  let headline = clampText(readable, 110);
  let whatChanged = clampText(cleanNewsText(article.summary || article.title), 210);
  let whyItMatters = "Useful market context for reading portfolio moves, rates, and protocol activity.";

  if (includesAny(lower, ["pendle"]) && includesAny(lower, ["live on monad", "now live on monad"])) {
    headline = "Pendle markets are live on Monad.";
    whatChanged = "Pendle launched Monad markets, adding routes for yield-bearing assets and yield-token trading.";
    whyItMatters = "More yield markets can change where users route capital, hedge rates, and compare DeFi opportunities.";
  } else if (includesAny(lower, ["portal_hq", "embedded wallet", "non-custodial embedded wallet"])) {
    headline = "Portal HQ is pushing embedded wallet infrastructure.";
    whatChanged = "Portal HQ is bringing non-custodial embedded wallets to apps so users can interact without seeing chain complexity.";
    whyItMatters = "Cleaner wallet UX can make onchain apps feel closer to normal fintech products.";
  } else if (includesAny(lower, ["blend_money", "blend money"]) && includesAny(lower, ["yield", "compliance", "neobank"])) {
    headline = "Blend Money is packaging yield with compliance tooling.";
    whatChanged = "Blend Money is positioning a yield and compliance stack for neobank-style onchain financial products.";
    whyItMatters = "This points to Monad apps moving beyond raw trading into regulated financial workflows.";
  } else if (includesAny(lower, ["yield is a commodity", "compliance is actually the real product"])) {
    headline = "The signal is compliance over commodity yield.";
    whatChanged = "The discussion frames yield as the easy-to-copy layer and compliance as the product that can create durable value.";
    whyItMatters = "That is useful context when judging which DeFi teams may turn rates into real distribution.";
  } else if (includesAny(lower, ["branchlesspay", "erp", "xero", "zoho", "wave"])) {
    headline = "BranchlessPay shipped more business integrations.";
    whatChanged = "BranchlessPay added ERP integrations and shared fresh usage metrics around volume, fees, and revenue.";
    whyItMatters = "Integrations and operating metrics are stronger adoption signals than another generic ecosystem announcement.";
  } else if (includesAny(lower, ["welcome to monad"]) && primaryName) {
    headline = `${primaryName} joined the Monad ecosystem.`;
    whatChanged = `${primaryName} is being welcomed into the Monad ecosystem, which usually signals a launch, integration, or partnership.`;
    whyItMatters = "New ecosystem additions can expand available apps, liquidity venues, or user acquisition channels.";
  } else if (includesAny(lower, ["introducing", "launched", "launching", "brings", "new markets"])) {
    const subject = primaryName || "A Monad ecosystem team";
    headline = `${subject} has a new ecosystem update.`;
    whatChanged = clampText(readable, 210);
    whyItMatters = includesAny(lower, ["market", "liquidity", "yield", "rates"])
      ? "New market structure can affect liquidity, rates, and where users deploy capital."
      : "This is a useful signal for tracking builder activity and ecosystem momentum.";
  }

  return {
    headline,
    whatChanged,
    whyItMatters,
  };
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
  const [imageFailed, setImageFailed] = useState(false);
  const brief = buildReadableBrief(article);
  const title = clampText(cleanNewsText(article.title), 132);
  const summary = clampText(cleanNewsText(article.summary), 170);
  const titleKey = normalizeText(title);
  const summaryKey = normalizeText(summary);
  const briefKey = normalizeText(brief.whatChanged);
  const hasSummary = Boolean(
    summary &&
      summaryKey !== titleKey &&
      !summaryKey.startsWith(titleKey) &&
      summaryKey !== briefKey &&
      !briefKey.startsWith(summaryKey)
  );
  const showImage = Boolean(article.imageUrl && !imageFailed);
  const source = sourceLabel(article);
  const meta = `${source} - ${formatRelativeTime(article.publishedAt)}`;
  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.025)] p-4 transition-colors hover:border-[var(--color-border-hover)] hover:bg-[rgba(255,255,255,0.035)]">
      {showImage && (
        <div className="mb-4 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- Remote news media can come from arbitrary hosts. */}
          <img
            src={article.imageUrl}
            alt={`${title || source} preview`}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="aspect-[16/9] w-full object-cover"
          />
        </div>
      )}

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="rounded-full border border-[rgba(0,245,204,0.22)] bg-[rgba(0,245,204,0.07)] px-2.5 py-1 text-[10px] font-bold uppercase text-[var(--color-positive)]">
          {article.topic}
        </span>
        <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.035)] px-2.5 py-1 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
          Smart read
        </span>
        <span className="min-w-0 truncate text-[11px] font-semibold text-[var(--color-text-dim)]">
          {meta}
        </span>
      </div>

      <h3 className="mt-3 text-[18px] font-bold leading-snug text-[var(--color-text-primary)]">
        {title || brief.headline || source}
      </h3>

      <div className="mt-3 grid gap-2 rounded-[var(--radius-md)] border border-[rgba(0,245,204,0.14)] bg-[rgba(0,245,204,0.035)] p-3">
        <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          <span className="font-bold text-[var(--color-text-primary)]">What happened: </span>
          {brief.whatChanged}
        </p>
        <p className="text-[13px] leading-relaxed text-[var(--color-text-muted)]">
          <span className="font-bold text-[var(--color-text-secondary)]">Why it matters: </span>
          {brief.whyItMatters}
        </p>
      </div>

      {hasSummary && (
        <p className="mt-3 border-l border-[var(--color-border)] pl-3 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
          Original signal: {summary}
        </p>
      )}

      {article.link ? (
        <a
          href={article.link}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold text-[var(--color-accent-primary)] transition-colors hover:text-[var(--color-positive)]"
        >
          <span>Verify source</span>
          <span aria-hidden="true">-&gt;</span>
        </a>
      ) : (
        <div className="mt-4 text-[11px] font-semibold text-[var(--color-text-dim)]">
          Added manually
        </div>
      )}
    </article>
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
            Plain-English reads of Monad and DeFi updates, with sources one tap away.
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
