import { randomUUID } from "crypto";
import { getServerRedisClient } from "@/lib/serverCache";
import { getErrorMessage, logServerEvent, logSlowSource, sourceNameFromUrl } from "@/lib/serverLog";

export interface NewsArticle {
  id: string;
  title: string;
  link: string;
  imageUrl?: string;
  source: string;
  summary: string;
  publishedAt: string;
  topic: string;
  submittedAt?: number;
}

export interface LatestNewsPayload {
  items: NewsArticle[];
  generatedAt: number;
  feedCount: number;
}

export interface NewsSubmissionInput {
  url?: string;
  link?: string;
  title?: string;
  summary?: string;
  text?: string;
  imageUrl?: string;
  source?: string;
  topic?: string;
  publishedAt?: string;
}

const CURATED_NEWS_KEY = "onchain-pulse:curated-news";
const NEWS_LIMIT = 20;
const NEWS_STORAGE_LIMIT = 50;
const NEWS_FETCH_TIMEOUT_MS = 5_000;
const MAX_FIELD_LENGTH = 2_000;
const MAX_BODY_LENGTH = 10_000;
const memoryNews: NewsArticle[] = [];

function cleanText(input: string) {
  return decodeHtmlEntities(input)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FIELD_LENGTH);
}

function summarize(text: string, maxLength = 220) {
  const cleaned = cleanText(text);
  if (cleaned.length <= maxLength) return cleaned;
  const cut = cleaned.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isShortenedUrl(value: string) {
  try {
    const host = new URL(value).hostname.replace(/^www\./u, "").toLowerCase();
    return [
      "t.co",
      "bit.ly",
      "tinyurl.com",
      "shorturl.at",
      "goo.gl",
      "ow.ly",
    ].includes(host);
  } catch {
    return false;
  }
}

function stripShortenedUrls(input: string) {
  return input.replace(/https?:\/\/\S+/giu, (match) => (isShortenedUrl(match) ? "" : match));
}

function isLikelyImageUrl(value: string) {
  try {
    const url = new URL(value);
    const path = url.pathname.toLowerCase();
    const format = url.searchParams.get("format")?.toLowerCase() || "";
    return (
      /\.(?:apng|avif|gif|jpe?g|png|webp)$/iu.test(path) ||
      ["avif", "gif", "jpg", "jpeg", "png", "webp"].includes(format)
    );
  } catch {
    return false;
  }
}

function stripImageUrls(input: string) {
  return input.replace(/https?:\/\/\S+/giu, (match) => (isLikelyImageUrl(match) ? "" : match));
}

function stripHiddenUrls(input: string) {
  return stripImageUrls(stripShortenedUrls(input));
}

function sourceFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./u, "");
  } catch {
    return "Manual";
  }
}

function parsePublishedAt(value?: string) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16))
    );
}

function findMeta(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta\\s+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>|<meta\\s+content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["'][^>]*>`,
    "iu"
  );
  const match = html.match(regex);
  return decodeHtmlEntities(match?.[1] || match?.[2] || "");
}

function findTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu);
  return decodeHtmlEntities(match?.[1] || "");
}

function resolveMetadataUrl(baseUrl: string, value: string) {
  const cleaned = decodeHtmlEntities(value).trim();
  if (!cleaned) return "";
  try {
    return new URL(cleaned, baseUrl).toString();
  } catch {
    return "";
  }
}

async function fetchUrlMetadata(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NEWS_FETCH_TIMEOUT_MS);
  const startedAt = Date.now();
  const source = sourceNameFromUrl(url);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "OnchainPulse/1.0",
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
    const durationMs = Date.now() - startedAt;
    logSlowSource(source, durationMs);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    return {
      title: cleanText(findMeta(html, "og:title") || findTitle(html)),
      summary: summarize(findMeta(html, "og:description") || findMeta(html, "description")),
      source: cleanText(findMeta(html, "og:site_name") || sourceFromUrl(url)),
      imageUrl: resolveMetadataUrl(
        url,
        findMeta(html, "og:image") ||
          findMeta(html, "og:image:url") ||
          findMeta(html, "twitter:image")
      ),
    };
  } catch (error) {
    logServerEvent("warn", "news.metadata_fetch_failed", {
      source,
      error: getErrorMessage(error),
    });
    return {
      title: "",
      summary: "",
      source: sourceFromUrl(url),
      imageUrl: "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function readCuratedNews() {
  const redis = getServerRedisClient();
  if (!redis) return [...memoryNews];

  const remote = await redis.get<NewsArticle[]>(CURATED_NEWS_KEY);
  if (!Array.isArray(remote)) return [...memoryNews];
  memoryNews.splice(0, memoryNews.length, ...remote);
  return remote;
}

async function writeCuratedNews(items: NewsArticle[]) {
  memoryNews.splice(0, memoryNews.length, ...items);
  const redis = getServerRedisClient();
  if (!redis) return;
  await redis.set(CURATED_NEWS_KEY, items);
}

function dedupeKey(item: Pick<NewsArticle, "link" | "title" | "source">) {
  return (item.link || `${item.title}|${item.source}`).trim().toLowerCase();
}

function sanitizeNewsArticle(item: NewsArticle): NewsArticle {
  const imageUrl = item.imageUrl || (isLikelyImageUrl(item.link) ? item.link : "");

  return {
    ...item,
    title: cleanText(stripHiddenUrls(item.title)),
    summary: summarize(stripHiddenUrls(item.summary)),
    link: isShortenedUrl(item.link) || isLikelyImageUrl(item.link) ? "" : item.link,
    imageUrl: imageUrl && !isShortenedUrl(imageUrl) ? imageUrl : undefined,
  };
}

export function assertValidNewsRequestBody(raw: string) {
  if (raw.length > MAX_BODY_LENGTH) {
    throw new Error("News submission is too large.");
  }
}

export async function addCuratedNews(input: NewsSubmissionInput) {
  const rawLink = cleanText(input.url || input.link || "");
  const directImageUrl = isLikelyImageUrl(rawLink) ? rawLink : "";
  const link = directImageUrl ? "" : rawLink;
  if (link && !isValidHttpUrl(link)) throw new Error("URL must start with http:// or https://");
  if (directImageUrl && !isValidHttpUrl(directImageUrl)) {
    throw new Error("Image URL must start with http:// or https://");
  }
  if (link && isShortenedUrl(link)) {
    throw new Error("Paste the direct original link instead of a shortened URL.");
  }
  if (directImageUrl && isShortenedUrl(directImageUrl)) {
    throw new Error("Paste the direct original image URL instead of a shortened URL.");
  }
  if (input.imageUrl && !isValidHttpUrl(input.imageUrl)) {
    throw new Error("Image URL must start with http:// or https://");
  }
  if (input.imageUrl && isShortenedUrl(input.imageUrl)) {
    throw new Error("Paste the direct original image URL instead of a shortened URL.");
  }

  const metadata = link ? await fetchUrlMetadata(link) : null;
  const fallbackText = stripHiddenUrls(input.text || input.summary || "");
  const title = cleanText(stripHiddenUrls(input.title || metadata?.title || summarize(fallbackText, 90)));
  const summary = summarize(stripHiddenUrls(input.summary || input.text || metadata?.summary || ""));
  const imageUrl = cleanText(input.imageUrl || metadata?.imageUrl || directImageUrl);
  const source = cleanText(input.source || metadata?.source || (link ? sourceFromUrl(link) : "Manual"));
  const topic = cleanText(input.topic || "Curated");

  if (!title) throw new Error("Add a title, summary, text, or URL with readable metadata.");

  const item: NewsArticle = {
    id: randomUUID(),
    title,
    link,
    imageUrl: imageUrl && !isShortenedUrl(imageUrl) ? imageUrl : undefined,
    source,
    summary,
    publishedAt: parsePublishedAt(input.publishedAt),
    topic,
    submittedAt: Date.now(),
  };

  const existing = await readCuratedNews();
  const key = dedupeKey(item);
  const next = [item, ...existing.filter((entry) => dedupeKey(entry) !== key)]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, NEWS_STORAGE_LIMIT);

  await writeCuratedNews(next);
  return item;
}

export async function loadLatestNews() {
  const items = (await readCuratedNews())
    .map(sanitizeNewsArticle)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, NEWS_LIMIT);

  return {
    items,
    generatedAt: Date.now(),
    feedCount: items.length,
  } satisfies LatestNewsPayload;
}
