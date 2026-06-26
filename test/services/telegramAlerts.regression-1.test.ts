import { describe, expect, it } from "vitest";
import {
  buildLatestNewsBriefText,
  getInitialDailyDigestDay,
  getMissedDigestSendDay,
} from "@/services/telegramAlerts";
import type { NewsArticle } from "@/lib/news";

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

  it("keeps channel news briefs eligible after the 11 PM IST hour is missed", () => {
    const justBeforeWindow = new Date("2026-06-24T17:25:00.000Z"); // 10:55 PM IST
    const afterMidnight = new Date("2026-06-24T19:09:00.000Z"); // 12:39 AM IST next day

    expect(getMissedDigestSendDay(justBeforeWindow, 23)).toBe("2026-06-23");
    expect(getMissedDigestSendDay(afterMidnight, 23)).toBe("2026-06-24");
  });

  it("formats daily news briefs as compact Telegram cards", () => {
    const message = buildLatestNewsBriefText([
      {
        id: "item-1",
        title:
          "@DeltaV_xyz: Podcast notes from DeltaV Builder Stories EP.3 with @mannyornothing, co-founder of @blend_money https://t.co/MHJ1BWVIgR",
        summary:
          "Podcast notes from DeltaV Builder Stories EP.3 with @mannyornothing, co-founder of @blend_money Yield is a commodity, compliance is actually the real product. https://t.co/MHJ1BWVIgR",
        source: "DeltaV_xyz",
        link: "https://x.com/DeltaV_xyz/status/2067985763858538955",
        topic: "Monad",
        publishedAt: "2026-06-23T17:52:00.000Z",
      },
      {
        id: "item-2",
        title: "@monad_eco: JUST IN: @pendle_fi is now live on Monad https://t.co/sgHudAYV91",
        summary: "JUST IN: @pendle_fi is now live on Monad https://t.co/sgHudAYV91",
        source: "monad_eco",
        link: "https://x.com/monad_eco/status/2067978668388065523",
        topic: "Monad",
        publishedAt: "2026-06-23T17:30:00.000Z",
      },
    ] satisfies NewsArticle[]);

    expect(message).toContain("Onchain Pulse daily brief");
    expect(message).not.toContain("Summary:");
    expect(message).not.toContain("Source:");
    expect(message).not.toContain("@DeltaV_xyz");
    expect(message.match(/https:\/\/t\.co/gu)).toBeNull();
    expect(message).toContain("1. DeltaV_xyz\n");
    expect(message).toContain("   Read: https://x.com/DeltaV_xyz/status/2067985763858538955");
    expect(message).toContain("2. monad_eco\n");
    expect(message).toContain("   Read: https://x.com/monad_eco/status/2067978668388065523");
  });

  it("labels already-truncated long posts as summaries", () => {
    const message = buildLatestNewsBriefText([
      {
        id: "item-1",
        title:
          "@DeltaV_xyz: An ecosystem of founders who ship every week @branchlesspay anchored 1,820 real transactions...",
        summary:
          "An ecosystem of founders who ship every week @branchlesspay anchored 1,820 real transactions, protected 63,262 in revenue, connected 17 platforms, and submitted Shopify and Clover apps. @surfcashx reached 9.5K...",
        source: "DeltaV_xyz",
        link: "https://x.com/DeltaV_xyz/status/2070132310134210790",
        topic: "Monad",
        publishedAt: "2026-06-25T18:53:00.000Z",
      },
    ] satisfies NewsArticle[]);

    expect(message).toContain("1. DeltaV_xyz");
    expect(message).toContain("   Summary:");
    expect(message).toContain("DeltaV highlighted weekly Monad ecosystem traction");
    expect(message).not.toContain("Summary: An ecosystem of founders who ship every week");
    expect(message).toContain("   Read: https://x.com/DeltaV_xyz/status/2070132310134210790");
  });
});
