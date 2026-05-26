import { getErrorMessage, logServerEvent, logSlowSource, sourceNameFromUrl } from "@/lib/serverLog";

export interface NewsArticle {
  title: string;
  link: string;
  source: string;
  summary: string;
  publishedAt: string;
  topic: string;
}

export interface NewsFeedQuery {
  label: string;
  query: string;
}

export interface LatestNewsPayload {
  items: NewsArticle[];
  generatedAt: number;
  feedCount: number;
}

export const NEWS_FEED_QUERIES: NewsFeedQuery[] = [
  { label: "Monad", query: "Monad crypto when:7d" },
  { label: "DeFi", query: "Monad DeFi when:7d" },
  { label: "Ecosystem", query: '"Monad Foundation" when:7d' },
];

export const NEWS_SEARCH_URL =
  "https://news.google.com/search?q=Monad%20crypto%20OR%20DeFi%20when:7d&hl=en-US&gl=US&ceid=US:en";

const NEWS_FEED_TTL_MS = 10 * 60 * 1000;
const NEWS_FEED_STALE_TTL_MS = 60 * 60 * 1000;
const NEWS_FEED_URL = "https://news.google.com/rss/search";
const NEWS_FETCH_TIMEOUT_MS = 4_000;
const NEWS_FETCH_RETRIES = 1;
const NEWS_LIMIT = 6;

function buildFeedUrl(query: string) {
  const params = new URLSearchParams({
    q: query,
    hl: "en-US",
    gl: "US",
    ceid: "US:en",
  });

  return `${NEWS_FEED_URL}?${params.toString()}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeXmlEntities(input: string) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16))
    );
}

function stripMarkup(input: string) {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanText(input: string) {
  const text = decodeXmlEntities(input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
  return stripMarkup(text);
}

function extractTag(block: string, tagName: string) {
  const tagRegex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(tagRegex);
  return match?.[1] || "";
}

function summarize(text: string, maxLength = 180) {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
}

function parsePublishedAt(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function parseGoogleNewsRss(xml: string, topic: string): NewsArticle[] {
  const items = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];

  return items
    .map((item) => {
      const title = cleanText(extractTag(item, "title"));
      const link = cleanText(extractTag(item, "link"));
      const source = cleanText(extractTag(item, "source")) || topic;
      const description = summarize(cleanText(extractTag(item, "description")));
      const publishedAt =
        cleanText(extractTag(item, "pubDate")) ||
        cleanText(extractTag(item, "published")) ||
        new Date().toISOString();

      if (!title || !link) return null;

      return {
        title,
        link,
        source,
        summary: description || title,
        publishedAt: new Date(parsePublishedAt(publishedAt)).toISOString(),
        topic,
      } satisfies NewsArticle;
    })
    .filter((item): item is NewsArticle => item !== null);
}

export function dedupeAndSortNews(items: NewsArticle[], limit = NEWS_LIMIT) {
  const unique = new Map<string, NewsArticle>();

  for (const item of items) {
    const key = item.link || `${item.title}|${item.source}`;
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, item);
      continue;
    }

    if (Date.parse(item.publishedAt) > Date.parse(existing.publishedAt)) {
      unique.set(key, item);
    }
  }

  return [...unique.values()]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, limit);
}

async function fetchTextWithRetry(
  url: string,
  {
    timeoutMs = NEWS_FETCH_TIMEOUT_MS,
    retries = NEWS_FETCH_RETRIES,
    retryDelayMs = 250,
    sourceName,
  }: {
    timeoutMs?: number;
    retries?: number;
    retryDelayMs?: number;
    sourceName?: string;
  } = {}
) {
  let lastError: unknown;
  const source = sourceName || sourceNameFromUrl(url);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent": "OnchainPulse/1.0",
          accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
      });

      const durationMs = Date.now() - startedAt;
      logSlowSource(source, durationMs);

      if (!response.ok) {
        logServerEvent("warn", "source.http_error", {
          source,
          status: response.status,
          attempt,
          durationMs,
        });
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      logServerEvent(attempt === retries ? "error" : "warn", "source.fetch_failed", {
        source,
        attempt,
        retries,
        error: getErrorMessage(error),
      });

      if (attempt === retries) break;
      await sleep(retryDelayMs * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

async function fetchFeed(query: NewsFeedQuery) {
  const xml = await fetchTextWithRetry(buildFeedUrl(query.query), {
    sourceName: `google-news:${query.label.toLowerCase()}`,
  });
  return parseGoogleNewsRss(xml, query.label);
}

export async function loadLatestNews() {
  const results = await Promise.allSettled(NEWS_FEED_QUERIES.map((query) => fetchFeed(query)));
  const items = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );

  return {
    items: dedupeAndSortNews(items, NEWS_LIMIT),
    generatedAt: Date.now(),
    feedCount: NEWS_FEED_QUERIES.length,
  } satisfies LatestNewsPayload;
}

export const newsCacheConfig = {
  ttlMs: NEWS_FEED_TTL_MS,
  staleTtlMs: NEWS_FEED_STALE_TTL_MS,
};
