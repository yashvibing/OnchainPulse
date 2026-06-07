import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/serverCache", () => ({
  getServerRedisClient: () => null,
}));

vi.mock("@/lib/news", () => ({
  loadLatestNews: vi.fn(async () => ({ items: [] })),
}));

vi.mock("@/services/yields-aggregator", () => ({
  fetchCombinedYieldOpportunities: vi.fn(async () => []),
  getOpportunityAssetSymbols: vi.fn(() => []),
}));

vi.mock("@/services/tokenMarkets", () => ({
  fetchTokenMarkets: vi.fn(async () => ({ data: [] })),
}));

const telegramFetch = vi.fn();

beforeEach(() => {
  vi.resetModules();
  telegramFetch.mockReset();
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_BOT_USERNAME = "test_bot";
});

describe("telegram alert bot commands", () => {
  it("handles connect, help, and unknown commands", async () => {
    telegramFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/getUpdates")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            result: [
              { update_id: 1, message: { text: "/connect", chat: { id: 42 } } },
              { update_id: 2, message: { text: "/help", chat: { id: 42 } } },
              { update_id: 3, message: { text: "/unknown", chat: { id: 42 } } },
            ],
          }),
        };
      }

      if (url.includes("/sendMessage")) {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        };
      }

      return {
        ok: false,
        json: async () => ({ ok: false }),
      };
    });

    vi.stubGlobal("fetch", telegramFetch);
    const { checkTelegramAlerts } = await import("@/services/telegramAlerts");

    await checkTelegramAlerts();

    const sentMessages = telegramFetch.mock.calls
      .map(([input, init]) => ({ url: String(input), body: String(init?.body || "") }))
      .filter((call) => call.url.includes("/sendMessage"))
      .map((call) => JSON.parse(call.body).text as string);

    expect(sentMessages).toContain("This Telegram chat is ready for Onchain Pulse alerts. Use the Alerts page to create watches.");
    expect(sentMessages.some((message) => message.includes("/delete <alert id>"))).toBe(true);
    expect(sentMessages).toContain("Unknown command. Use /help to see available alert commands.");
  });
});
