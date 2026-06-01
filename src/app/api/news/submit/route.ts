import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse, withRateLimitHeaders } from "@/lib/rateLimit";
import { getErrorMessage, logServerEvent } from "@/lib/serverLog";
import { addCuratedNews, assertValidNewsRequestBody, type NewsSubmissionInput } from "@/lib/news";

export const dynamic = "force-dynamic";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/iu);
  return match?.[1]?.trim() || "";
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, {
    namespace: "news-submit",
    limit: 20,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  const expectedToken = process.env.NEWS_INGEST_TOKEN || "";
  if (!expectedToken) {
    return NextResponse.json(
      { ok: false, error: "NEWS_INGEST_TOKEN is not configured." },
      { status: 503, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }

  if (getBearerToken(request) !== expectedToken) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized news submission." },
      { status: 401, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }

  try {
    const raw = await request.text();
    assertValidNewsRequestBody(raw);
    const body = JSON.parse(raw) as NewsSubmissionInput;
    const item = await addCuratedNews(body);
    logServerEvent("info", "news.submitted", {
      topic: item.topic,
      source: item.source,
      hasLink: Boolean(item.link),
    });

    return NextResponse.json(
      { ok: true, item },
      { status: 201, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 400, headers: withRateLimitHeaders(undefined, rateLimit) }
    );
  }
}
