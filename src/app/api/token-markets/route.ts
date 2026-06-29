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
        data: result.data.markets,
        meta: {
          cache: result.status,
          ageMs: result.ageMs,
          fetchedAt: result.fetchedAt,
          durationMs: result.durationMs,
          source: "GeckoTerminal",
          pagesLoaded: result.data.pagesLoaded,
          pagesExpected: result.data.pagesExpected,
          partial: result.status === "stale" || result.data.partial,
          warnings: [
            ...(result.status === "stale" ? ["Showing a stale cached market snapshot."] : []),
            ...result.data.warnings,
          ],
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
      {
        error: getErrorMessage(error).includes("429")
          ? "Market data is temporarily rate limited"
          : "Failed to load token markets",
      },
      { status: 500, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}
