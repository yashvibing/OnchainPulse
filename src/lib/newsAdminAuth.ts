export const DEFAULT_NEWS_ADMIN_USERNAME = "OPbolte";
export const NEWS_ADMIN_COOKIE = "op_news_admin";
export const NEWS_ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12;

const encoder = new TextEncoder();

function base64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

export function safeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

export function getNewsAdminUsername() {
  return process.env.NEWS_ADMIN_USERNAME || DEFAULT_NEWS_ADMIN_USERNAME;
}

export function getNewsAdminSecret() {
  return process.env.NEWS_ADMIN_PASSWORD || process.env.NEWS_INGEST_TOKEN || "";
}

async function signNewsAdminPayload(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64Url(signature);
}

export async function createNewsAdminSession(secret: string, now = Date.now()) {
  const expiresAt = now + NEWS_ADMIN_COOKIE_MAX_AGE * 1000;
  const payload = String(expiresAt);
  const signature = await signNewsAdminPayload(payload, secret);
  return `${payload}.${signature}`;
}

export async function isValidNewsAdminSession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
) {
  if (!token || !secret) {
    return false;
  }

  const [expiresAtValue, signature] = token.split(".");
  const expiresAt = Number(expiresAtValue);
  if (!Number.isFinite(expiresAt) || !signature || expiresAt < now) {
    return false;
  }

  const expectedSignature = await signNewsAdminPayload(expiresAtValue, secret);
  return safeEqual(signature, expectedSignature);
}
