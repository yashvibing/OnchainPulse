import { describe, expect, it } from "vitest";
import { dedupeAndSortNews, parseGoogleNewsRss } from "@/lib/news";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[Monad lands new DeFi partnership &amp; expands ecosystem]]></title>
      <link>https://example.com/monad-defi-partnership</link>
      <source url="https://example.com">The Block</source>
      <pubDate>Mon, 25 May 2026 09:30:00 GMT</pubDate>
      <description><![CDATA[Monad <b>announced</b> a new integration with a DeFi protocol.]]></description>
    </item>
    <item>
      <title><![CDATA[Monad lands new DeFi partnership &amp; expands ecosystem]]></title>
      <link>https://example.com/monad-defi-partnership</link>
      <source url="https://example.com">The Block</source>
      <pubDate>Mon, 25 May 2026 09:45:00 GMT</pubDate>
      <description><![CDATA[Duplicate item that should be deduped.]]></description>
    </item>
    <item>
      <title><![CDATA[Crypto market watch: Monad ecosystem gains momentum]]></title>
      <link>https://example.com/monad-market-watch</link>
      <source url="https://example.com">CoinDesk</source>
      <pubDate>Mon, 25 May 2026 10:00:00 GMT</pubDate>
      <description><![CDATA[The latest coverage around Monad and DeFi.]]></description>
    </item>
  </channel>
</rss>`;

describe("news feed parsing", () => {
  it("parses RSS items into news articles", () => {
    const items = parseGoogleNewsRss(SAMPLE_RSS, "Monad");

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      title: "Monad lands new DeFi partnership & expands ecosystem",
      link: "https://example.com/monad-defi-partnership",
      source: "The Block",
      summary: "Monad announced a new integration with a DeFi protocol.",
      topic: "Monad",
    });
  });

  it("deduplicates items by link and keeps the newest version", () => {
    const items = parseGoogleNewsRss(SAMPLE_RSS, "Monad");
    const deduped = dedupeAndSortNews(items, 10);

    expect(deduped).toHaveLength(2);
    expect(deduped[0].title).toBe("Crypto market watch: Monad ecosystem gains momentum");
    expect(deduped[1].publishedAt).toBe("2026-05-25T09:45:00.000Z");
    expect(deduped[1].summary).toBe("Duplicate item that should be deduped.");
  });
});
