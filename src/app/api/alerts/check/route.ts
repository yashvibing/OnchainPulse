import { NextResponse } from "next/server";
import { getErrorMessage, logServerEvent, logSlowApi } from "@/lib/serverLog";
import { checkTelegramAlerts } from "@/services/telegramAlerts";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === "development";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  if (!process.env.CRON_SECRET && process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await checkTelegramAlerts();
    logSlowApi("/api/alerts/check", Date.now() - startedAt);
    return NextResponse.json({
      ok: true,
      checkedAt: Date.now(),
      ...result,
    });
  } catch (error) {
    logServerEvent("error", "api.failed", {
      route: "/api/alerts/check",
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { ok: false, error: "Failed to check alerts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
