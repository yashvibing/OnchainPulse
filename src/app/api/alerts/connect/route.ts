import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/rateLimit";
import { getErrorMessage, logServerEvent } from "@/lib/serverLog";
import {
  createTelegramConnectSession,
  disconnectTelegramChat,
} from "@/services/telegramAlerts";

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "alerts-connect",
    limit: 10,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const body = await request.json().catch(() => ({}));
    const session = await createTelegramConnectSession(
      body.loginToken ? String(body.loginToken) : undefined
    );
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

export async function DELETE(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "alerts-disconnect",
    limit: 10,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const body = await request.json().catch(() => ({}));
    const result = await disconnectTelegramChat(
      String(body.chatId || ""),
      body.loginToken ? String(body.loginToken) : undefined
    );

    return NextResponse.json(
      { ok: true, ...result },
      { headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  } catch (error) {
    logServerEvent("warn", "alerts.disconnect_failed", {
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}
