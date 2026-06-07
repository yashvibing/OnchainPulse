import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/rateLimit";
import { getErrorMessage, logServerEvent, logSlowApi } from "@/lib/serverLog";
import { fetchAnalytics } from "@/services/analytics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const rateLimit = await checkRateLimit(request, {
    namespace: "analytics",
    limit: 90,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const result = await fetchAnalytics();
    logSlowApi("/api/analytics", Date.now() - startedAt);
    return NextResponse.json(
      {
        data: result.data,
        meta: {
          cache: result.status,
          ageMs: result.ageMs,
          fetchedAt: result.fetchedAt,
          durationMs: result.durationMs,
          sources: result.data.sources,
        },
      },
      { headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  } catch (error) {
    logServerEvent("error", "api.failed", {
      route: "/api/analytics",
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { error: "Failed to load analytics" },
      { status: 500, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}
