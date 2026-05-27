import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LatestNewsSection } from "@/components/LatestNewsSection";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        status: "miss",
        fetchedAt: Date.now(),
        generatedAt: Date.now(),
        feedCount: 3,
        items: [
          {
            title: "Monad lands new DeFi partnership",
            link: "https://example.com/article",
            source: "The Block",
            summary: "Monad announced a new integration with a DeFi protocol.",
            publishedAt: "2026-05-25T10:00:00.000Z",
            topic: "Monad",
          },
        ],
      }),
    }))
  );
});

describe("LatestNewsSection", () => {
  it("renders a news card from the API response", async () => {
    render(<LatestNewsSection />);

    expect(screen.getByText("Monad Market Updates")).toBeInTheDocument();
    expect(await screen.findByText("Monad lands new DeFi partnership")).toBeInTheDocument();
    expect(screen.getByText(/The Block/)).toBeInTheDocument();
    expect(screen.getByText(/Why it matters:/)).toBeInTheDocument();
    expect(screen.getByText("Open full feed")).toBeInTheDocument();
  });
});
