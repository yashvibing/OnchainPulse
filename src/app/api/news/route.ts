import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse, withRateLimitHeaders } from "@/lib/rateLimit";
import { getErrorMessage, logSlowApi } from "@/lib/serverLog";
import { getServerCacheBackend, withServerCache } from "@/lib/serverCache";
import { loadLatestNews, newsCacheConfig } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const rateLimit = await checkRateLimit(request, {
    namespace: "news",
    limit: 20,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const cached = await withServerCache(
      "latest-news",
      newsCacheConfig.ttlMs,
      loadLatestNews,
      newsCacheConfig.staleTtlMs
    );

    const response = NextResponse.json(
      {
        ok: cached.data.items.length > 0,
        status: cached.status,
        fetchedAt: cached.fetchedAt,
        ageMs: cached.ageMs,
        durationMs: cached.durationMs,
        cache: {
          backend: getServerCacheBackend(),
        },
        ...cached.data,
      },
      { status: 200, headers: withRateLimitHeaders(undefined, rateLimit) }
    );

    logSlowApi("/api/news", Date.now() - startedAt);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        error: getErrorMessage(error),
        items: [],
        generatedAt: Date.now(),
        feedCount: 0,
        cache: {
          backend: getServerCacheBackend(),
        },
      },
      { status: 200, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}
