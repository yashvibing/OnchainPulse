import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse, withRateLimitHeaders } from "@/lib/rateLimit";
import { getErrorMessage } from "@/lib/serverLog";
import {
  getTelegramNotificationPreferences,
  updateTelegramNotificationPreferences,
  type TelegramNotificationPreferences,
} from "@/services/telegramAlerts";

const PREFERENCE_KEYS: Array<keyof TelegramNotificationPreferences> = [
  "defiRateAlerts",
  "dailyDefiBrief",
  "latestNewsBrief",
  "ecosystemUpdates",
  "securityUpdates",
];

function sanitizePreferences(input: unknown) {
  const source = input && typeof input === "object"
    ? input as Partial<Record<keyof TelegramNotificationPreferences, unknown>>
    : {};

  return PREFERENCE_KEYS.reduce<Partial<TelegramNotificationPreferences>>((acc, key) => {
    if (typeof source[key] === "boolean") acc[key] = source[key];
    return acc;
  }, {});
}

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "alerts-preferences",
    limit: 60,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const url = new URL(request.url);
    const chatId = String(url.searchParams.get("chatId") || "");
    const preferences = await getTelegramNotificationPreferences(chatId);
    return NextResponse.json(
      { preferences },
      { headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}

export async function PATCH(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "alerts-preferences-update",
    limit: 30,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const body = await request.json();
    const chatId = String(body.chatId || "");
    const preferences = await updateTelegramNotificationPreferences(
      chatId,
      sanitizePreferences(body.preferences)
    );

    return NextResponse.json(
      { preferences },
      { headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}
