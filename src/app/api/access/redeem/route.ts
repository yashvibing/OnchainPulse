import { NextResponse } from "next/server";
import {
  createAccessSession,
  setAccessCookie,
} from "@/lib/accessGate";
import { redeemAccessCode } from "@/lib/accessRedeem";

export async function POST(request: Request) {
  let body: { code?: unknown; next?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Enter a valid access code." },
      { status: 400 },
    );
  }

  const code = typeof body.code === "string" ? body.code : "";
  const result = await redeemAccessCode(code);

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        message:
          result.reason === "used"
            ? "This access code has already been used."
            : "Access code not recognized.",
      },
      { status: 401 },
    );
  }

  const nextPath =
    typeof body.next === "string" && body.next.startsWith("/") ? body.next : "/";
  const response = NextResponse.json({ ok: true, next: nextPath });
  setAccessCookie(
    response,
    await createAccessSession(),
    new URL(request.url).protocol === "https:",
  );
  return response;
}
