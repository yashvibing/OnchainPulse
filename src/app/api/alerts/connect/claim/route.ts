import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/rateLimit";
import { getErrorMessage, logServerEvent } from "@/lib/serverLog";
import { claimTelegramConnectSession } from "@/services/telegramAlerts";

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "alerts-claim",
    limit: 20,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const body = await request.json();
    const code = String(body.code || "");
    const session = await claimTelegramConnectSession(code);
    return NextResponse.json(
      {
        chatId: session.chatId,
        connectedAt: Date.now(),
      },
      { headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  } catch (error) {
    logServerEvent("warn", "alerts.claim_failed", {
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}
