import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createNewsAdminSession,
  getNewsAdminSecret,
  getNewsAdminUsername,
  isValidNewsAdminSession,
  NEWS_ADMIN_COOKIE,
  NEWS_ADMIN_COOKIE_MAX_AGE,
  safeEqual,
} from "@/lib/newsAdminAuth";

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

export async function middleware(request: NextRequest) {
  const expectedUsername = getNewsAdminUsername();
  const expectedPassword = getNewsAdminSecret();

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

  const sessionToken = request.cookies.get(NEWS_ADMIN_COOKIE)?.value;
  if (await isValidNewsAdminSession(sessionToken, expectedPassword)) {
    return NextResponse.next();
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

  const response = NextResponse.next();
  response.cookies.set(NEWS_ADMIN_COOKIE, await createNewsAdminSession(expectedPassword), {
    httpOnly: true,
    maxAge: NEWS_ADMIN_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });

  return response;
}

export const config = {
  matcher: ["/news/admin/:path*"],
};
