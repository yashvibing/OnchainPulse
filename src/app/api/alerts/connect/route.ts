import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/rateLimit";
import { getErrorMessage, logServerEvent } from "@/lib/serverLog";
import { createTelegramConnectSession } from "@/services/telegramAlerts";

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "alerts-connect",
    limit: 10,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const session = await createTelegramConnectSession();
    return NextResponse.json(session, {
      status: 201,
      headers: withRateLimitHeaders(undefined, rateLimit),
    });
  } catch (error) {
    logServerEvent("warn", "alerts.connect_failed", {
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 503, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}
