import { createHash } from "crypto";

type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, string | number | boolean | null | undefined>;

const SLOW_API_THRESHOLD_MS = 2_500;
const SLOW_SOURCE_THRESHOLD_MS = 3_000;

function sanitizeFields(fields: LogFields = {}) {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key,
        typeof value === "string" ? redactSensitiveText(value) : value,
      ])
  );
}

export function shortHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

export function redactSensitiveText(value: string) {
  return value.replace(/0x[a-fA-F0-9]{40}/g, (match) => `addr:${shortHash(match.toLowerCase())}`);
}

export function logServerEvent(
  level: LogLevel,
  event: string,
  fields: LogFields = {}
) {
  const payload = {
    scope: "onchain-pulse",
    event,
    ts: new Date().toISOString(),
    ...sanitizeFields(fields),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export function sourceNameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "unknown-source";
  }
}

export function logSlowApi(route: string, durationMs: number) {
  if (durationMs < SLOW_API_THRESHOLD_MS) return;
  logServerEvent("warn", "api.slow", { route, durationMs });
}

export function logSlowSource(source: string, durationMs: number) {
  if (durationMs < SLOW_SOURCE_THRESHOLD_MS) return;
  logServerEvent("warn", "source.slow", { source, durationMs });
}
