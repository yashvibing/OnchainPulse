import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/rateLimit";
import { getErrorMessage, logServerEvent } from "@/lib/serverLog";
import { verifyTelegramLogin } from "@/services/telegramAlerts";

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "alerts-telegram-login",
    limit: 20,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const body = await request.json();
    const result = await verifyTelegramLogin(body);
    return NextResponse.json(
      {
        identity: {
          id: result.user.userId,
          username: result.user.username,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          photoUrl: result.user.photoUrl,
          loginToken: result.loginToken,
          connectedAt: result.user.updatedAt,
        },
        connection: result.user.chatId
          ? {
              chatId: result.user.chatId,
              connectedAt: result.user.updatedAt,
            }
          : null,
      },
      { headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  } catch (error) {
    logServerEvent("warn", "alerts.telegram_login_failed", {
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 401, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}
