import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { withServerCache } from "@/lib/serverCache";
import { isValidEvmAddress } from "@/lib/format";
import {
  checkRateLimit,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/rateLimit";
import { getErrorMessage, logServerEvent, logSlowApi } from "@/lib/serverLog";
import { fetchPortfolioSnapshot } from "@/services/portfolio";

export const dynamic = "force-dynamic";

const PORTFOLIO_TTL_MS = 60_000;
const PORTFOLIO_STALE_TTL_MS = 10 * 60_000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const startedAt = Date.now();
  const rateLimit = await checkRateLimit(request, {
    namespace: "portfolio",
    limit: 60,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  const { address } = await params;
  if (!isValidEvmAddress(address)) {
    return NextResponse.json(
      { error: "Invalid address" },
      { status: 400, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }

  const normalized = getAddress(address);

  try {
    const result = await withServerCache(
      `portfolio:${normalized.toLowerCase()}`,
      PORTFOLIO_TTL_MS,
      () => fetchPortfolioSnapshot(normalized as `0x${string}`),
      PORTFOLIO_STALE_TTL_MS
    );

    const response = NextResponse.json(
      {
        ...result.data,
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
              "Cache-Control": "s-maxage=60, stale-while-revalidate=600",
              "X-Cache-Status": result.status,
              "X-Cache-Age-Ms": String(result.ageMs),
            },
            rateLimit
          ),
        },
      }
    );
    logSlowApi("/api/portfolio/[address]", Date.now() - startedAt);
    return response;
  } catch (error) {
    logServerEvent("error", "api.failed", {
      route: "/api/portfolio/[address]",
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { error: "Failed to load portfolio" },
      { status: 502 }
    );
  }
}
