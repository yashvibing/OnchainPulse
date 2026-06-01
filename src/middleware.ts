import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DEFAULT_ADMIN_USERNAME = "OPbolte";
const REALM = "Onchain Pulse News Admin";

function unauthorized() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Cache-Control": "no-store",
    },
  });
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function parseBasicAuth(header: string | null) {
  if (!header) {
    return null;
  }

  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) {
    return null;
  }

  try {
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const expectedUsername =
    process.env.NEWS_ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME;
  const expectedPassword =
    process.env.NEWS_ADMIN_PASSWORD || process.env.NEWS_INGEST_TOKEN || "";

  if (!expectedPassword) {
    return new NextResponse(
      "NEWS_ADMIN_PASSWORD or NEWS_INGEST_TOKEN is not configured.",
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const credentials = parseBasicAuth(request.headers.get("authorization"));
  if (!credentials) {
    return unauthorized();
  }

  const usernameMatches = credentials.username === expectedUsername;
  const passwordMatches = safeEqual(credentials.password, expectedPassword);

  if (!usernameMatches || !passwordMatches) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/news/admin/:path*"],
};
