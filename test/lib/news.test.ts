import { describe, expect, it } from "vitest";
import { addCuratedNews, loadLatestNews } from "@/lib/news";

describe("curated news feed", () => {
  it("stores manual submissions in the latest news feed", async () => {
    const title = `Manual Monad update ${Date.now()}`;
    const item = await addCuratedNews({
      title,
      summary: "A manually curated update for the feed.",
      topic: "Monad",
      source: "Manual",
      publishedAt: "2026-05-25T10:00:00.000Z",
    });

    const feed = await loadLatestNews();

    expect(item).toMatchObject({
      title,
      link: "",
      source: "Manual",
      summary: "A manually curated update for the feed.",
      topic: "Monad",
    });
    expect(feed.items.some((entry) => entry.id === item.id)).toBe(true);
  });

  it("publishes immediately when no published date is provided", async () => {
    const before = Date.now();
    const item = await addCuratedNews({
      title: `Immediate curated update ${before}`,
      summary: "A curated update without a manual publish date.",
      topic: "Monad",
      source: "Manual",
    });
    const after = Date.now();
    const publishedAt = Date.parse(item.publishedAt);

    expect(publishedAt).toBeGreaterThanOrEqual(before);
    expect(publishedAt).toBeLessThanOrEqual(after);
  });

  it("does not duplicate the title as summary", async () => {
    const title = `Title only curated update ${Date.now()}`;
    const item = await addCuratedNews({
      title,
      topic: "Bitcoin",
      source: "Manual",
    });

    expect(item.title).toBe(title);
    expect(item.summary).toBe("");
  });

  it("deduplicates by title and source when no link is present", async () => {
    const title = `Duplicate curated update ${Date.now()}`;

    await addCuratedNews({
      title,
      source: "Manual",
      summary: "Older version.",
      publishedAt: "2026-05-25T09:30:00.000Z",
    });

    const newest = await addCuratedNews({
      title,
      source: "Manual",
      summary: "Newest version.",
      publishedAt: "2026-05-25T09:45:00.000Z",
    });

    const feed = await loadLatestNews();
    const matches = feed.items.filter(
      (entry) => entry.title === title && entry.source === "Manual"
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe(newest.id);
    expect(matches[0].summary).toBe("Newest version.");
  });

  it("rejects shortened source URLs", async () => {
    await expect(
      addCuratedNews({
        url: "https://t.co/sgHudAYV91",
        title: "Pendle is live on Monad",
      })
    ).rejects.toThrow("direct original link");
  });

  it("stores the direct link and strips short links from pasted text", async () => {
    const item = await addCuratedNews({
      url: "https://x.com/monad_eco/status/2067978668388065523",
      title: "@monad_eco: JUST IN: @pendle_fi is now live on Monad https://t.co/sgHudAYV91",
      summary: "JUST IN: @pendle_fi is now live on Monad https://t.co/sgHudAYV91",
      source: "monad_eco",
    });

    expect(item.link).toBe("https://x.com/monad_eco/status/2067978668388065523");
    expect(item.title).not.toContain("https://t.co");
    expect(item.summary).not.toContain("https://t.co");
  });
});
