import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/rateLimit";
import { getErrorMessage, logServerEvent, logSlowApi } from "@/lib/serverLog";
import {
  fetchTokenMarketChart,
  isTokenChartRange,
  isTokenChartSide,
} from "@/services/tokenMarketCharts";

export const dynamic = "force-dynamic";

function isPoolAddress(value: string | null): value is string {
  return Boolean(value && /^0x[a-f0-9]{40,64}$/iu.test(value));
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const rateLimit = await checkRateLimit(request, {
    namespace: "token-market-chart",
    limit: 120,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  const url = new URL(request.url);
  const pool = url.searchParams.get("pool");
  const range = url.searchParams.get("range");
  const side = url.searchParams.get("side") || "base";

  if (!isPoolAddress(pool) || !isTokenChartRange(range) || !isTokenChartSide(side)) {
    return NextResponse.json(
      { error: "Invalid chart request" },
      { status: 400, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }

  try {
    const result = await fetchTokenMarketChart(pool, range, side);
    logSlowApi("/api/token-market-chart", Date.now() - startedAt);
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
    logServerEvent("warn", "api.failed", {
      route: "/api/token-market-chart",
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      {
        data: [],
        meta: {
          cache: "unavailable",
          ageMs: 0,
          fetchedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          source: "GeckoTerminal",
        },
      },
      { status: 200, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}
