import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/rateLimit";
import { fetchCombinedYieldOpportunitiesWithMeta } from "@/services/yields-aggregator";

export const revalidate = 300;

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "yield-opportunities",
    limit: 180,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const result = await fetchCombinedYieldOpportunitiesWithMeta();
    return NextResponse.json(result.data, {
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
  } catch (error) {
    console.error("[yield-opportunities] failed", error);
    return NextResponse.json(
      { error: "Failed to fetch yield opportunities" },
      { status: 502 }
    );
  }
}
