import { NextResponse } from "next/server";
import {
  getNewsAdminSecret,
  isValidNewsAdminSession,
  NEWS_ADMIN_COOKIE,
} from "@/lib/newsAdminAuth";
import { addCuratedNews } from "@/lib/news";
import {
  assertValidNewsTipBody,
  getNewsTip,
  listNewsTips,
  submitNewsTip,
  updateNewsTip,
  type NewsTip,
  type NewsTipInput,
} from "@/lib/newsTips";
import { checkRateLimit, rateLimitResponse, withRateLimitHeaders } from "@/lib/rateLimit";
import { getErrorMessage, logServerEvent } from "@/lib/serverLog";
import { sendTelegramChannelMessage } from "@/services/telegramAlerts";

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

function tipTopic(tip: NewsTip) {
  if (tip.category === "security") return "Security";
  if (tip.category === "protocol") return "Protocol";
  if (tip.category === "launch") return "Launch";
  if (tip.category === "rates") return "Rates";
  return "Community";
}

function telegramMessageForTip(tip: NewsTip) {
  const label = tip.category === "security" ? "Important security update" : "Important ecosystem update";
  return `${label}\n\n${tip.text}\n\nSource: ${tip.url}`;
}

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "news-tips-admin",
    limit: 60,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  if (!(await hasAdminSession(request))) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized tip review request." },
      { status: 401, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }

  const tips = await listNewsTips();
  return NextResponse.json(
    { ok: true, tips },
    { headers: withRateLimitHeaders(undefined, rateLimit) }
  );
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "news-tip-submit",
    limit: 3,
    windowSeconds: 60 * 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  try {
    const raw = await request.text();
    assertValidNewsTipBody(raw);
    const tip = await submitNewsTip(JSON.parse(raw) as NewsTipInput);

    logServerEvent("info", "news.tip_submitted", {
      category: tip.category,
      source: tip.sourceHandle,
    });

    return NextResponse.json(
      { ok: true, tip },
      { status: 201, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 400, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}

export async function PATCH(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "news-tip-review",
    limit: 30,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  if (!(await hasAdminSession(request))) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized tip review request." },
      { status: 401, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }

  try {
    const body = await request.json() as { id?: string; action?: string };
    const id = String(body.id || "");
    const action = String(body.action || "");

    if (action === "publish") {
      const tip = await getNewsTip(id);
      if (!tip) throw new Error("Tip not found.");
      const item = await addCuratedNews({
        url: tip.url,
        summary: tip.text,
        source: tip.sourceHandle,
        topic: tipTopic(tip),
      });
      const updatedTip = await updateNewsTip(id, { publishedAt: Date.now() });
      return NextResponse.json(
        { ok: true, tip: updatedTip, item },
        { headers: withRateLimitHeaders(undefined, rateLimit) }
      );
    }

    if (action === "broadcast") {
      const tip = await getNewsTip(id);
      if (!tip) throw new Error("Tip not found.");
      await sendTelegramChannelMessage(telegramMessageForTip(tip));
      const updatedTip = await updateNewsTip(id, { sentAt: Date.now() });
      return NextResponse.json(
        { ok: true, tip: updatedTip, sent: 1 },
        { headers: withRateLimitHeaders(undefined, rateLimit) }
      );
    }

    if (action === "dismiss") {
      const tip = await updateNewsTip(id, { dismissedAt: Date.now() });
      return NextResponse.json(
        { ok: true, tip },
        { headers: withRateLimitHeaders(undefined, rateLimit) }
      );
    }

    throw new Error("Choose publish, broadcast, or dismiss.");
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 400, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}
