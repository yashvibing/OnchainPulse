import {
  isConfiguredAccessCode,
  normalizeConfiguredAccessCode,
} from "@/lib/accessGate";
import { getServerRedisClient } from "@/lib/serverCache";

const usedCodes = new Set<string>();

function accessCodeKey(code: string) {
  return `onchain-pulse:access-code:${code}`;
}

export async function redeemAccessCode(code: string) {
  const normalized = normalizeConfiguredAccessCode(code);
  if (!isConfiguredAccessCode(normalized)) {
    return { ok: false, reason: "invalid" as const };
  }

  const redis = getServerRedisClient();
  if (!redis) {
    if (usedCodes.has(normalized)) {
      return { ok: false, reason: "used" as const };
    }
    usedCodes.add(normalized);
    return { ok: true as const };
  }

  const claimed = await redis.set(accessCodeKey(normalized), "used", {
    nx: true,
  });

  if (!claimed) {
    return { ok: false, reason: "used" as const };
  }

  return { ok: true as const };
}
