import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getServerRedisClient } from "@/lib/serverCache";

interface RateLimitOptions {
  namespace: string;
  limit: number;
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

interface MemoryLimitEntry {
  count: number;
  resetAt: number;
}

const memoryLimits = new Map<string, MemoryLimitEntry>();

function getClientFingerprint(request: Request) {
  const forwardedFor =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const ip = forwardedFor.split(",")[0]?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  return createHash("sha256")
    .update(`${ip}:${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}

function makeRateLimitKey(
  request: Request,
  namespace: string,
  windowStart: number
) {
  return `onchain-pulse:rate:${namespace}:${getClientFingerprint(request)}:${windowStart}`;
}

function rateLimitHeaders(result: RateLimitResult) {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

export function withRateLimitHeaders(
  headers: HeadersInit | undefined,
  result: RateLimitResult
): HeadersInit {
  return {
    ...(headers || {}),
    ...rateLimitHeaders(result),
  };
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    {
      error: "Too many requests",
      retryAfterSeconds: Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)),
    },
    {
      status: 429,
      headers: {
        ...rateLimitHeaders(result),
        "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
      },
    }
  );
}

function checkMemoryRateLimit(
  key: string,
  limit: number,
  resetAt: number
): RateLimitResult {
  const now = Date.now();
  for (const [entryKey, entry] of memoryLimits.entries()) {
    if (entry.resetAt <= now) memoryLimits.delete(entryKey);
  }

  const entry = memoryLimits.get(key);
  const count = entry && entry.resetAt > now ? entry.count + 1 : 1;
  memoryLimits.set(key, { count, resetAt });

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

export async function checkRateLimit(
  request: Request,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;
  const key = makeRateLimitKey(request, options.namespace, windowStart);
  const redis = getServerRedisClient();

  if (!redis) {
    return checkMemoryRateLimit(key, options.limit, resetAt);
  }

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, options.windowSeconds + 5);
    }

    return {
      allowed: count <= options.limit,
      limit: options.limit,
      remaining: Math.max(0, options.limit - count),
      resetAt,
    };
  } catch (error) {
    console.warn(`[rate-limit] redis failed for ${options.namespace}`, error);
    return {
      allowed: true,
      limit: options.limit,
      remaining: options.limit,
      resetAt,
    };
  }
}
