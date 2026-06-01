import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/rateLimit";
import { getErrorMessage, logServerEvent, logSlowApi } from "@/lib/serverLog";
import {
  createTelegramAlert,
  deleteTelegramAlert,
  getTelegramAlertConfig,
  listTelegramAlertsForChat,
  updateTelegramAlert,
  type AlertKind,
} from "@/services/telegramAlerts";

const ALERT_KINDS = new Set<AlertKind>([
  "apr_above",
  "apr_below",
  "best_market_change",
  "new_market",
  "daily_digest",
  "daily_news_brief",
]);

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "alerts-config",
    limit: 60,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  const url = new URL(request.url);
  const chatId = url.searchParams.get("chatId");
  if (chatId) {
    const alerts = await listTelegramAlertsForChat(chatId);
    return NextResponse.json({ alerts }, {
      headers: withRateLimitHeaders(undefined, rateLimit),
    });
  }

  return NextResponse.json(getTelegramAlertConfig(), {
    headers: withRateLimitHeaders(undefined, rateLimit),
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const rateLimit = await checkRateLimit(request, {
    namespace: "alerts-create",
    limit: 20,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const body = await request.json();
    const kind = body.kind as AlertKind;
    if (!ALERT_KINDS.has(kind)) {
      return NextResponse.json(
        { error: "Unsupported alert type" },
        { status: 400, headers: withRateLimitHeaders(undefined, rateLimit) }
      );
    }

    const thresholdApr = body.thresholdApr === "" || body.thresholdApr === undefined
      ? undefined
      : Number(body.thresholdApr);

    if ((kind === "apr_above" || kind === "apr_below") && !Number.isFinite(thresholdApr)) {
      return NextResponse.json(
        { error: "APR threshold is required" },
        { status: 400, headers: withRateLimitHeaders(undefined, rateLimit) }
      );
    }

    const alert = await createTelegramAlert({
      kind,
      chatId: String(body.chatId || ""),
      tokenSymbol: String(body.tokenSymbol || "ANY"),
      protocolKey: body.protocolKey ? String(body.protocolKey) : undefined,
      protocolLabel: body.protocolLabel ? String(body.protocolLabel) : undefined,
      thresholdApr,
    });

    logSlowApi("/api/alerts", Date.now() - startedAt);
    return NextResponse.json(
      {
        id: alert.id,
        kind: alert.kind,
        tokenSymbol: alert.tokenSymbol,
        protocolKey: alert.protocolKey,
        protocolLabel: alert.protocolLabel,
        thresholdApr: alert.thresholdApr,
        createdAt: alert.createdAt,
      },
      { status: 201, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  } catch (error) {
    logServerEvent("error", "api.failed", {
      route: "/api/alerts",
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}

export async function PATCH(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "alerts-update",
    limit: 30,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const body = await request.json();
    const id = String(body.id || "");
    const chatId = String(body.chatId || "");
    const status = body.status === "active" || body.status === "paused" ? body.status : undefined;
    const thresholdApr = body.thresholdApr === undefined ? undefined : Number(body.thresholdApr);

    const alert = await updateTelegramAlert(id, chatId, {
      status,
      thresholdApr: Number.isFinite(thresholdApr) ? thresholdApr : undefined,
    });

    return NextResponse.json({ alert }, {
      headers: withRateLimitHeaders(undefined, rateLimit),
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}

export async function DELETE(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "alerts-delete",
    limit: 30,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const body = await request.json();
    await deleteTelegramAlert(String(body.id || ""), String(body.chatId || ""));
    return NextResponse.json({ ok: true }, {
      headers: withRateLimitHeaders(undefined, rateLimit),
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}
