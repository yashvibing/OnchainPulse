import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { withServerCache } from "@/lib/serverCache";
import { isValidEvmAddress } from "@/lib/format";
import {
  checkRateLimit,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/rateLimit";
import { serializeTokenBalances } from "@/services/portfolio";
import { fetchTokenBalances } from "@/services/tokens";

export const dynamic = "force-dynamic";

const TOKEN_BALANCE_TTL_MS = 60_000;
const TOKEN_BALANCE_STALE_TTL_MS = 10 * 60_000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "token-balances",
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
      `token-balances:${normalized.toLowerCase()}`,
      TOKEN_BALANCE_TTL_MS,
      async () => serializeTokenBalances(await fetchTokenBalances(normalized as `0x${string}`)),
      TOKEN_BALANCE_STALE_TTL_MS
    );

    return NextResponse.json(
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
              "Cache-Control": "s-maxage=60, stale-while-revalidate=600",
              "X-Cache-Status": result.status,
              "X-Cache-Age-Ms": String(result.ageMs),
            },
            rateLimit
          ),
        },
      }
    );
  } catch (error) {
    console.error("[token-balances] failed", error);
    return NextResponse.json(
      { error: "Failed to load token balances" },
      { status: 502 }
    );
  }
}
