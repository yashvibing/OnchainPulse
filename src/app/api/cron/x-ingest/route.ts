import { NextResponse } from "next/server";
import { getErrorMessage, logServerEvent, logSlowApi } from "@/lib/serverLog";
import { ingestTrackedXTweets } from "@/services/xTracking";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await ingestTrackedXTweets();
    logSlowApi("/api/cron/x-ingest", Date.now() - startedAt);
    return NextResponse.json({
      ok: true,
      checkedAt: Date.now(),
      ...result,
    });
  } catch (error) {
    logServerEvent("error", "api.failed", {
      route: "/api/cron/x-ingest",
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { ok: false, error: "Failed to ingest X updates" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
