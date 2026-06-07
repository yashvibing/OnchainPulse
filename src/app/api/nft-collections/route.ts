import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/rateLimit";
import { getErrorMessage, logServerEvent, logSlowApi } from "@/lib/serverLog";
import { fetchNftCollections } from "@/services/nftCollections";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const startedAt = Date.now();
  const rateLimit = await checkRateLimit(request, {
    namespace: "nft-collections",
    limit: 90,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const result = await fetchNftCollections();
    logSlowApi("/api/nft-collections", Date.now() - startedAt);
    return NextResponse.json(
      {
        data: result.data,
        meta: {
          cache: result.status,
          ageMs: result.ageMs,
          fetchedAt: result.fetchedAt,
          durationMs: result.durationMs,
          source: "OpenSea",
        },
      },
      { headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  } catch (error) {
    const message = getErrorMessage(error);
    const setupMissing = message.includes("OPENSEA_API_KEY");

    logServerEvent(setupMissing ? "warn" : "error", "api.failed", {
      route: "/api/nft-collections",
      durationMs: Date.now() - startedAt,
      error: message,
    });

    return NextResponse.json(
      {
        error: setupMissing
          ? "OpenSea API key is not configured"
          : "Failed to load NFT collections",
      },
      {
        status: setupMissing ? 503 : 500,
        headers: withRateLimitHeaders(undefined, rateLimit),
      }
    );
  }
}
