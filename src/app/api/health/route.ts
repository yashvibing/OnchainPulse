import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/rateLimit";
import { monadClient } from "@/lib/client";
import { getServerCacheBackend, getServerCacheStats } from "@/lib/serverCache";
import { fetchJsonWithRetry } from "@/lib/sourceFetch";

export const dynamic = "force-dynamic";

async function checkSource(name: string, check: () => Promise<unknown>) {
  const startedAt = Date.now();
  try {
    await check();
    return {
      name,
      ok: true,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "health",
    limit: 10,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  const sources = await Promise.all([
    checkSource("defillama-yields", () =>
      fetchJsonWithRetry("https://yields.llama.fi/pools", {
        retries: 0,
        timeoutMs: 4_000,
      })
    ),
    checkSource("merkl-opportunities", () =>
      fetchJsonWithRetry("https://api.merkl.xyz/v4/opportunities?chainId=143&action=LEND&page=0", {
        retries: 0,
        timeoutMs: 4_000,
        next: { revalidate: 60 },
      })
    ),
    checkSource("monad-rpc", () => monadClient.getBlockNumber()),
  ]);

  const ok = sources.every((source) => source.ok);

  return NextResponse.json(
    {
      ok,
      checkedAt: Date.now(),
      sources,
      cache: {
        backend: getServerCacheBackend(),
        memoryEntries: getServerCacheStats(),
      },
    },
    { status: ok ? 200 : 207, headers: withRateLimitHeaders(undefined, rateLimit) }
  );
}
