import { NextResponse } from "next/server";
import {
  getNewsAdminSecret,
  isValidNewsAdminSession,
  NEWS_ADMIN_COOKIE,
} from "@/lib/newsAdminAuth";
import { checkRateLimit, rateLimitResponse, withRateLimitHeaders } from "@/lib/rateLimit";
import { getErrorMessage, logServerEvent } from "@/lib/serverLog";
import {
  getWeeklyEcosystemUpdate,
  setWeeklyEcosystemUpdate,
} from "@/services/telegramAlerts";

export const dynamic = "force-dynamic";

function getCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const target = `${name}=`;
  const match = cookies.find((cookie) => cookie.startsWith(target));
  return match ? decodeURIComponent(match.slice(target.length)) : "";
}

async function hasAdminSession(request: Request) {
  const expectedAdminSecret = getNewsAdminSecret();
  const adminSession = getCookie(request, NEWS_ADMIN_COOKIE);
  return isValidNewsAdminSession(adminSession, expectedAdminSecret);
}

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "weekly-ecosystem-get",
    limit: 60,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  if (!(await hasAdminSession(request))) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized weekly ecosystem update request." },
      { status: 401, headers: withRateLimitHeaders(undefined, rateLimit) },
    );
  }

  const update = await getWeeklyEcosystemUpdate();
  return NextResponse.json(
    { ok: true, update },
    { headers: withRateLimitHeaders(undefined, rateLimit) },
  );
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "weekly-ecosystem-submit",
    limit: 20,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  if (!(await hasAdminSession(request))) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized weekly ecosystem update request." },
      { status: 401, headers: withRateLimitHeaders(undefined, rateLimit) },
    );
  }

  try {
    const body = await request.json();
    const update = await setWeeklyEcosystemUpdate({
      twitterUrl: String(body.twitterUrl || ""),
      title: String(body.title || ""),
    });

    logServerEvent("info", "news.weekly_ecosystem_update_saved", {
      hasLink: Boolean(update.twitterUrl),
    });

    return NextResponse.json(
      { ok: true, update },
      { status: 201, headers: withRateLimitHeaders(undefined, rateLimit) },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 400, headers: withRateLimitHeaders(undefined, rateLimit) },
    );
  }
}
