import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/rateLimit";
import { getErrorMessage, logServerEvent, logSlowApi } from "@/lib/serverLog";
import { fetchCombinedYieldOpportunitiesWithMeta } from "@/services/yields-aggregator";

export const revalidate = 300;

export async function GET(request: Request) {
  const startedAt = Date.now();
  const rateLimit = await checkRateLimit(request, {
    namespace: "yield-opportunities",
    limit: 180,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const result = await fetchCombinedYieldOpportunitiesWithMeta();
    const response = NextResponse.json({
      data: result.data.opportunities,
      meta: {
        sources: result.data.sources,
      },
    }, {
      headers: withRateLimitHeaders(
        {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=1800",
          "X-Cache-Status": result.status,
          "X-Cache-Age-Ms": String(result.ageMs),
          "X-Data-Fetched-At": String(result.fetchedAt),
        },
        rateLimit
      ),
    });
    logSlowApi("/api/yield-opportunities", Date.now() - startedAt);
    return response;
  } catch (error) {
    logServerEvent("error", "api.failed", {
      route: "/api/yield-opportunities",
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { error: "Failed to fetch yield opportunities" },
      { status: 502 }
    );
  }
}
