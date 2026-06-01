import { describe, expect, it } from "vitest";
import { addCuratedNews } from "@/lib/news";

describe("curated news entity regression", () => {
  it("decodes non-breaking spaces from submitted summaries", async () => {
    const article = await addCuratedNews({
      title: `Monad price coverage ${Date.now()}`,
      source: "Manual",
      summary: "Monad rally update &nbsp;&nbsp; Coinspot.io",
      topic: "Monad",
    });

    expect(article.summary).toBe("Monad rally update Coinspot.io");
    expect(article.summary).not.toContain("&nbsp;");
  });
});
