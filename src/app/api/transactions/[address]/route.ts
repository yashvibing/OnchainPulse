import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { isValidEvmAddress } from "@/lib/format";
import {
  checkRateLimit,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/rateLimit";
import { withServerCache } from "@/lib/serverCache";
import { getErrorMessage, logServerEvent, logSlowApi } from "@/lib/serverLog";
import { fetchWalletTransactionHistory } from "@/services/transactions";

export const dynamic = "force-dynamic";

const TRANSACTION_TTL_MS = 60_000;
const TRANSACTION_STALE_TTL_MS = 10 * 60_000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const startedAt = Date.now();
  const rateLimit = await checkRateLimit(request, {
    namespace: "transactions",
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

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || 20);
  const cursor = url.searchParams.get("cursor") || "";
  const normalized = getAddress(address);

  try {
    const result = await withServerCache(
      `transactions:${normalized.toLowerCase()}:${Math.min(Math.max(limit, 1), 50)}:${cursor}`,
      TRANSACTION_TTL_MS,
      () =>
        fetchWalletTransactionHistory(normalized as `0x${string}`, {
          limit,
          cursor,
        }),
      TRANSACTION_STALE_TTL_MS
    );

    logSlowApi("/api/transactions/[address]", Date.now() - startedAt);
    return NextResponse.json(
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
        headers: withRateLimitHeaders(
          {
            "Cache-Control": "s-maxage=60, stale-while-revalidate=600",
            "X-Cache-Status": result.status,
          },
          rateLimit
        ),
      }
    );
  } catch (error) {
    logServerEvent("error", "api.failed", {
      route: "/api/transactions/[address]",
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { error: "Failed to load transaction history" },
      { status: 502, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}
