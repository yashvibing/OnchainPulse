import { describe, expect, it } from "vitest";
import { parseGoogleNewsRss } from "@/lib/news";

describe("news feed entity regression", () => {
  it("decodes non-breaking spaces from Google News descriptions", () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Monad price coverage</title>
      <link>https://example.com/monad-price</link>
      <source url="https://example.com">Coinspot</source>
      <pubDate>Wed, 27 May 2026 05:00:00 GMT</pubDate>
      <description><![CDATA[Monad rally update &nbsp;&nbsp; Coinspot.io]]></description>
    </item>
  </channel>
</rss>`;

    // Regression: ISSUE-001 - Google News summaries rendered raw &nbsp; text.
    // Found by /qa on 2026-05-27
    // Report: .gstack/qa-reports/qa-report-onchainpulse-app-2026-05-27.md
    const [article] = parseGoogleNewsRss(rss, "Monad");

    expect(article.summary).toBe("Monad rally update Coinspot.io");
    expect(article.summary).not.toContain("&nbsp;");
  });
});
