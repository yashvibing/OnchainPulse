import { describe, expect, it } from "vitest";
import { getWeeklyEcosystemWeekKeyForTest } from "@/services/telegramAlerts";

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
