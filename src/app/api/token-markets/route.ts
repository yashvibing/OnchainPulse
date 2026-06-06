import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/rateLimit";
import { getErrorMessage, logServerEvent, logSlowApi } from "@/lib/serverLog";
import { fetchTokenMarkets } from "@/services/tokenMarkets";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const rateLimit = await checkRateLimit(request, {
    namespace: "token-markets",
    limit: 90,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const result = await fetchTokenMarkets();
    logSlowApi("/api/token-markets", Date.now() - startedAt);
    return NextResponse.json(
      {
        data: result.data,
        meta: {
          cache: result.status,
          ageMs: result.ageMs,
          fetchedAt: result.fetchedAt,
          durationMs: result.durationMs,
          source: "GeckoTerminal",
        },
      },
      { headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  } catch (error) {
    logServerEvent("error", "api.failed", {
      route: "/api/token-markets",
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { error: "Failed to load token markets" },
      { status: 500, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}
