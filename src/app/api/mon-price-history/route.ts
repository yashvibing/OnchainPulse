import { NextResponse } from "next/server";
import { withServerCache } from "@/lib/serverCache";
import {
  checkRateLimit,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/rateLimit";
import { getErrorMessage, logServerEvent, logSlowApi } from "@/lib/serverLog";
import { fetchJsonWithRetry } from "@/lib/sourceFetch";

export const revalidate = 300;

interface DefiLlamaChartResponse {
  coins?: {
    "coingecko:monad"?: {
      prices?: { timestamp: number; price: number }[];
    };
  };
}

const PRICE_HISTORY_TTL_MS = 5 * 60_000;

async function fetchPriceHistory() {
  const now = Math.floor(Date.now() / 1000);
  const weekAgo = now - 7 * 86400;
  const data = await fetchJsonWithRetry<DefiLlamaChartResponse>(
    `https://coins.llama.fi/chart/coingecko:monad?start=${weekAgo}&span=168&period=1h`,
    { next: { revalidate: 300 }, retries: 1 }
  );
  const prices = data.coins?.["coingecko:monad"]?.prices;
  if (!Array.isArray(prices)) return [];

  return prices.map((point) => ({
    timestamp: point.timestamp,
    value: point.price,
  }));
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const rateLimit = await checkRateLimit(request, {
    namespace: "mon-price-history",
    limit: 180,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const result = await withServerCache(
      "mon-price-history",
      PRICE_HISTORY_TTL_MS,
      fetchPriceHistory,
      60 * 60_000
    );

    const response = NextResponse.json(
      {
        data: result.data,
        meta: {
          cacheStatus: result.status,
          cacheAgeMs: result.ageMs,
          fetchedAt: result.fetchedAt,
          durationMs: result.durationMs,
        },
      },
      {
        headers: {
          ...withRateLimitHeaders(
            {
              "Cache-Control": "s-maxage=300, stale-while-revalidate=3600",
              "X-Cache-Status": result.status,
              "X-Cache-Age-Ms": String(result.ageMs),
            },
            rateLimit
          ),
        },
      }
    );
    logSlowApi("/api/mon-price-history", Date.now() - startedAt);
    return response;
  } catch (error) {
    logServerEvent("error", "api.failed", {
      route: "/api/mon-price-history",
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    return NextResponse.json({ error: "Failed to load price history" }, { status: 502 });
  }
}
