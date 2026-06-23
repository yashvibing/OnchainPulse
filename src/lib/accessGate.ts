import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const ACCESS_COOKIE = "op_access";
const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const ACCESS_COOKIE_PREFIX = "onchain-pulse-access";

function normalizeAccessCode(code: string) {
  return code.trim().toUpperCase();
}

function getConfiguredAccessCodes() {
  return new Set(
    (process.env.ACCESS_CODES || "")
      .split(/[\s,]+/)
      .map(normalizeAccessCode)
      .filter(Boolean),
  );
}

function getAccessSecret() {
  return (
    process.env.ACCESS_GATE_SECRET ||
    process.env.NEWS_INGEST_TOKEN ||
    process.env.NEWS_ADMIN_PASSWORD ||
    "local-access-gate-secret"
  );
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(message: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toHex(signature);
}

export function isConfiguredAccessCode(code: string) {
  return getConfiguredAccessCodes().has(normalizeAccessCode(code));
}

export function normalizeConfiguredAccessCode(code: string) {
  return normalizeAccessCode(code);
}

export async function createAccessSession() {
  const timestamp = Date.now().toString();
  const payload = `${ACCESS_COOKIE_PREFIX}.${timestamp}`;
  const signature = await hmacSha256(payload, getAccessSecret());
  return `${payload}.${signature}`;
}

export async function isValidAccessSession(token?: string | null) {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [prefix, timestamp, signature] = parts;
  if (prefix !== ACCESS_COOKIE_PREFIX || !timestamp || !signature) return false;

  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt)) return false;

  const ageMs = Date.now() - issuedAt;
  if (ageMs < 0 || ageMs > ACCESS_COOKIE_MAX_AGE * 1000) return false;

  const expected = await hmacSha256(`${prefix}.${timestamp}`, getAccessSecret());
  return signature === expected;
}

export async function redirectToAccess(request: NextRequest) {
  const accessUrl = request.nextUrl.clone();
  accessUrl.pathname = "/access";
  accessUrl.search = "";
  accessUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(accessUrl);
}

export function setAccessCookie(response: NextResponse, token: string, secure: boolean) {
  response.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    maxAge: ACCESS_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure,
  });
}
