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
            id: "news-test-1",
            title: "Monad lands new DeFi partnership",
            link: "https://example.com/article",
            imageUrl: "https://cdn.example.com/monad-card.jpg",
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

    expect(await screen.findByText("Curated signal feed")).toBeInTheDocument();
    expect(await screen.findByText("Monad lands new DeFi partnership")).toBeInTheDocument();
    expect(screen.getByText(/The Block/)).toBeInTheDocument();
    expect(screen.getByText("Monad announced a new integration with a DeFi protocol.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Monad lands new DeFi partnership preview/u })).toHaveAttribute(
      "src",
      "https://cdn.example.com/monad-card.jpg"
    );
    expect(screen.getByRole("link", { name: /View news/u })).toHaveAttribute(
      "href",
      "https://example.com/article"
    );
    expect(screen.queryByText(/cdn\.example\.com/u)).not.toBeInTheDocument();
    expect(screen.queryByText("Add news")).not.toBeInTheDocument();
  });
});
