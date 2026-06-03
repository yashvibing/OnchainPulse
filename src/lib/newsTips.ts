import { randomUUID } from "crypto";
import { getServerRedisClient } from "@/lib/serverCache";

export type NewsTipCategory = "security" | "protocol" | "launch" | "rates" | "other";

export interface NewsTip {
  id: string;
  url: string;
  text: string;
  category: NewsTipCategory;
  sourceProfileUrl: string;
  sourceHandle: string;
  submittedAt: number;
  publishedAt?: number;
  sentAt?: number;
  dismissedAt?: number;
}

export interface NewsTipInput {
  url: string;
  text: string;
  category?: string;
}

const NEWS_TIPS_KEY = "onchain-pulse:news-tips";
const NEWS_TIPS_STORAGE_LIMIT = 100;
const NEWS_TIPS_LIST_LIMIT = 50;
const MAX_TEXT_LENGTH = 500;
const MAX_BODY_LENGTH = 5_000;
const memoryTips: NewsTip[] = [];

function cleanText(value: string, maxLength = MAX_TEXT_LENGTH) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeCategory(value?: string): NewsTipCategory {
  const category = (value || "").trim().toLowerCase();
  if (["security", "protocol", "launch", "rates"].includes(category)) {
    return category as NewsTipCategory;
  }
  return "other";
}

function parseXPostUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.replace(/^www\./u, "").toLowerCase();
  if (host !== "x.com" && host !== "twitter.com") {
    throw new Error("Add an x.com or twitter.com post link.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const handle = parts[0] || "";
  const hasStatus = parts.some((part) => part.toLowerCase() === "status");
  if (!handle || !hasStatus) {
    throw new Error("Add a direct X/Twitter post link.");
  }

  return {
    url: `https://x.com/${parts.join("/")}`,
    sourceHandle: `@${handle}`,
    sourceProfileUrl: `https://x.com/${handle}`,
  };
}

async function readTips() {
  const redis = getServerRedisClient();
  if (!redis) return [...memoryTips];

  const remote = await redis.get<NewsTip[]>(NEWS_TIPS_KEY);
  if (!Array.isArray(remote)) return [...memoryTips];
  memoryTips.splice(0, memoryTips.length, ...remote);
  return remote;
}

async function writeTips(tips: NewsTip[]) {
  const next = tips
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, NEWS_TIPS_STORAGE_LIMIT);
  memoryTips.splice(0, memoryTips.length, ...next);

  const redis = getServerRedisClient();
  if (!redis) return;
  await redis.set(NEWS_TIPS_KEY, next);
}

export function assertValidNewsTipBody(raw: string) {
  if (raw.length > MAX_BODY_LENGTH) {
    throw new Error("Update submission is too large.");
  }
}

export async function submitNewsTip(input: NewsTipInput) {
  const parsed = parseXPostUrl(cleanText(input.url, 800));
  const text = cleanText(input.text);
  if (text.length < 10) throw new Error("Add a short note with at least 10 characters.");

  const existing = await readTips();
  const existingTip = existing.find((tip) => tip.url.toLowerCase() === parsed.url.toLowerCase());
  if (existingTip && !existingTip.dismissedAt) {
    throw new Error("This update was already submitted for review.");
  }

  const tip: NewsTip = {
    id: randomUUID(),
    url: parsed.url,
    text,
    category: normalizeCategory(input.category),
    sourceHandle: parsed.sourceHandle,
    sourceProfileUrl: parsed.sourceProfileUrl,
    submittedAt: Date.now(),
  };

  await writeTips([tip, ...existing.filter((entry) => entry.url.toLowerCase() !== tip.url.toLowerCase())]);
  return tip;
}

export async function listNewsTips() {
  return (await readTips())
    .filter((tip) => !tip.dismissedAt)
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, NEWS_TIPS_LIST_LIMIT);
}

export async function getNewsTip(id: string) {
  return (await readTips()).find((entry) => entry.id === id) || null;
}

export async function updateNewsTip(id: string, changes: Partial<NewsTip>) {
  const tips = await readTips();
  const tip = tips.find((entry) => entry.id === id);
  if (!tip) throw new Error("Tip not found.");

  const updated = { ...tip, ...changes };
  await writeTips(tips.map((entry) => (entry.id === id ? updated : entry)));
  return updated;
}
