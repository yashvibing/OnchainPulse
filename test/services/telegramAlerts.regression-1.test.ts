import { describe, expect, it } from "vitest";
import { getInitialDailyDigestDay } from "@/services/telegramAlerts";

describe("telegram daily digest alerts", () => {
  it("keeps same-day delivery available when a digest is created before send time", () => {
    // Regression: ISSUE-001 - daily digests created before 11 AM IST were seeded as already sent.
    // Found by /qa on 2026-05-23.
    // Report: .gstack/qa-reports/qa-report-localhost-2026-05-23.md
    const beforeDigestWindow = new Date("2026-05-23T05:00:00.000Z"); // 10:30 AM IST

    expect(getInitialDailyDigestDay(beforeDigestWindow)).toBeUndefined();
  });

  it("waits until the next day when a digest is created after send time", () => {
    // Regression: ISSUE-001 - daily digests should not fire immediately after the daily window.
    // Found by /qa on 2026-05-23.
    // Report: .gstack/qa-reports/qa-report-localhost-2026-05-23.md
    const afterDigestWindow = new Date("2026-05-23T06:00:00.000Z"); // 11:30 AM IST

    expect(getInitialDailyDigestDay(afterDigestWindow)).toBe("2026-05-23");
  });

  it("keeps news briefs available until the 11 PM IST send time", () => {
    const beforeNewsBriefWindow = new Date("2026-05-23T16:45:00.000Z"); // 10:15 PM IST

    expect(getInitialDailyDigestDay(beforeNewsBriefWindow, 23)).toBeUndefined();
  });

  it("seeds news briefs as sent after 11 PM IST", () => {
    const afterNewsBriefWindow = new Date("2026-05-23T18:00:00.000Z"); // 11:30 PM IST

    expect(getInitialDailyDigestDay(afterNewsBriefWindow, 23)).toBe("2026-05-23");
  });
});
