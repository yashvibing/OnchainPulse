import { afterEach, describe, expect, it } from "vitest";
import {
  getTelegramChannelConfig,
  getWeeklyEcosystemWeekKeyForTest,
} from "@/services/telegramAlerts";

const originalEnv = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHANNEL_ID: process.env.TELEGRAM_CHANNEL_ID,
  TELEGRAM_CHANNEL_USERNAME: process.env.TELEGRAM_CHANNEL_USERNAME,
  NEXT_PUBLIC_TELEGRAM_CHANNEL_URL: process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL,
};

function restoreEnv(key: keyof typeof originalEnv) {
  const value = originalEnv[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  restoreEnv("TELEGRAM_BOT_TOKEN");
  restoreEnv("TELEGRAM_CHANNEL_ID");
  restoreEnv("TELEGRAM_CHANNEL_USERNAME");
  restoreEnv("NEXT_PUBLIC_TELEGRAM_CHANNEL_URL");
});

describe("telegram weekly ecosystem updates", () => {
  it("groups the week by Monday in IST", () => {
    expect(
      getWeeklyEcosystemWeekKeyForTest(new Date("2026-06-01T00:30:00.000Z"))
    ).toBe("2026-06-01");
  });

  it("keeps late Sunday UTC inside the next IST week when it is Monday in India", () => {
    expect(
      getWeeklyEcosystemWeekKeyForTest(new Date("2026-05-31T19:00:00.000Z"))
    ).toBe("2026-06-01");
  });
});

describe("telegram channel config", () => {
  it("derives a public channel URL from the channel username", () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    delete process.env.TELEGRAM_CHANNEL_ID;
    process.env.TELEGRAM_CHANNEL_USERNAME = "onchainpulse";
    delete process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL;

    expect(getTelegramChannelConfig()).toEqual({
      configured: true,
      channelUrl: "https://t.me/onchainpulse",
    });
  });
});
