import { describe, expect, it } from "vitest";
import { getInitialDailyDigestDay } from "@/services/telegramAlerts";

describe("telegram daily digest alerts", () => {
  it("keeps same-day delivery available when a digest is created before send time", () => {
    // Regression: ISSUE-001 - daily digests created before 9 AM IST were seeded as already sent.
    // Found by /qa on 2026-05-23.
    // Report: .gstack/qa-reports/qa-report-localhost-2026-05-23.md
    const beforeDigestWindow = new Date("2026-05-23T02:30:00.000Z"); // 8:00 AM IST

    expect(getInitialDailyDigestDay(beforeDigestWindow)).toBeUndefined();
  });

  it("waits until the next day when a digest is created after send time", () => {
    // Regression: ISSUE-001 - daily digests should not fire immediately after the daily window.
    // Found by /qa on 2026-05-23.
    // Report: .gstack/qa-reports/qa-report-localhost-2026-05-23.md
    const afterDigestWindow = new Date("2026-05-23T04:00:00.000Z"); // 9:30 AM IST

    expect(getInitialDailyDigestDay(afterDigestWindow)).toBe("2026-05-23");
  });
});
