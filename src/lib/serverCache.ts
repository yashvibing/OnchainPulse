import { Redis } from "@upstash/redis";
import { getErrorMessage, logServerEvent, redactSensitiveText } from "@/lib/serverLog";

type CacheStatus = "hit" | "miss" | "stale";
type CacheBackend = "redis" | "memory";

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  lastDurationMs: number;
}

export interface CacheResult<T> {
  data: T;
  status: CacheStatus;
  ageMs: number;
  fetchedAt: number;
  durationMs: number;
}

interface CacheStat {
  key: string;
  ageMs: number;
  fetchedAt: number;
  lastDurationMs: number;
}

const entries = new Map<string, CacheEntry<unknown>>();
const pending = new Map<string, Promise<CacheEntry<unknown>>>();

let redis: Redis | null | undefined;

function redisCacheKey(key: string) {
  return `onchain-pulse:cache:${key}`;
}

function getRedisEnv() {
  return {
    url:
      process.env.UPSTASH_REDIS_REST_URL ||
      process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ||
      process.env.KV_REST_API_URL,
    token:
      process.env.UPSTASH_REDIS_REST_TOKEN ||
      process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ||
      process.env.KV_REST_API_TOKEN,
  };
}

function getRedis() {
  if (redis !== undefined) return redis;

  const { url, token } = getRedisEnv();
  if (!url || !token) {
    redis = null;
    return redis;
  }

  redis = new Redis({ url, token });
  return redis;
}

export function getServerRedisClient() {
  return getRedis();
}

export function getServerCacheBackend(): CacheBackend {
  return getRedis() ? "redis" : "memory";
}

async function readEntry<T>(key: string): Promise<CacheEntry<T> | undefined> {
  const local = entries.get(key) as CacheEntry<T> | undefined;
  const client = getRedis();

  if (!client) return local;

  try {
    const remote = await client.get<CacheEntry<T>>(redisCacheKey(key));
    if (!remote) return local;
    entries.set(key, remote as CacheEntry<unknown>);
    return remote;
  } catch (error) {
    logServerEvent("warn", "cache.redis_read_failed", {
      cacheKey: key,
      error: getErrorMessage(error),
    });
    return local;
  }
}

async function writeEntry<T>(
  key: string,
  entry: CacheEntry<T>,
  staleTtlMs: number
) {
  entries.set(key, entry as CacheEntry<unknown>);

  const client = getRedis();
  if (!client) return;

  try {
    await client.set(redisCacheKey(key), entry, {
      ex: Math.ceil(staleTtlMs / 1000),
    });
  } catch (error) {
    logServerEvent("warn", "cache.redis_write_failed", {
      cacheKey: key,
      error: getErrorMessage(error),
    });
  }
}

export async function withServerCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  staleTtlMs = ttlMs * 6
): Promise<CacheResult<T>> {
  const now = Date.now();
  const existing = await readEntry<T>(key);

  if (existing && now - existing.fetchedAt < ttlMs) {
    return {
      data: existing.data,
      status: "hit",
      ageMs: now - existing.fetchedAt,
      fetchedAt: existing.fetchedAt,
      durationMs: existing.lastDurationMs,
    };
  }

  const pendingLoad = pending.get(key) as Promise<CacheEntry<T>> | undefined;
  if (pendingLoad) {
    const entry = await pendingLoad;
    return {
      data: entry.data,
      status: "hit",
      ageMs: Date.now() - entry.fetchedAt,
      fetchedAt: entry.fetchedAt,
      durationMs: entry.lastDurationMs,
    };
  }

  const load = (async () => {
    const startedAt = Date.now();
    const data = await loader();
    const entry: CacheEntry<T> = {
      data,
      fetchedAt: Date.now(),
      lastDurationMs: Date.now() - startedAt,
    };
    await writeEntry(key, entry, staleTtlMs);
    return entry;
  })();

  pending.set(key, load);

  try {
    const entry = await load;
    logServerEvent("info", "cache.miss", {
      cacheKey: key,
      durationMs: entry.lastDurationMs,
    });
    return {
      data: entry.data,
      status: "miss",
      ageMs: Date.now() - entry.fetchedAt,
      fetchedAt: entry.fetchedAt,
      durationMs: entry.lastDurationMs,
    };
  } catch (error) {
    if (existing && now - existing.fetchedAt < staleTtlMs) {
      logServerEvent("warn", "cache.stale_fallback", {
        cacheKey: key,
        ageMs: now - existing.fetchedAt,
        error: getErrorMessage(error),
      });
      return {
        data: existing.data,
        status: "stale",
        ageMs: now - existing.fetchedAt,
        fetchedAt: existing.fetchedAt,
        durationMs: existing.lastDurationMs,
      };
    }
    throw error;
  } finally {
    pending.delete(key);
  }
}

export function getServerCacheStats(): CacheStat[] {
  const now = Date.now();
  return [...entries.entries()].map(([key, entry]) => ({
    key: redactSensitiveText(key),
    ageMs: now - entry.fetchedAt,
    fetchedAt: entry.fetchedAt,
    lastDurationMs: entry.lastDurationMs,
  }));
}
