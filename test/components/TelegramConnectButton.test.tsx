import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AlertCreator } from "@/components/AlertCreator";
import { AlertManagement } from "@/components/AlertManagement";

vi.mock("@/services/yields-aggregator", () => ({
  fetchYieldOpportunitiesWithClientMeta: vi.fn(async () => ({ data: [] })),
  getOpportunityAssetSymbols: vi.fn(() => []),
}));

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: "Telegram bot is not configured" }),
    }))
  );
});

describe("Telegram connection CTA", () => {
  it("starts Telegram link creation from the connection step", async () => {
    render(
      <>
        <AlertCreator />
        <AlertManagement />
      </>
    );

    const button = await screen.findByRole("button", {
      name: "Create Telegram link",
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/alerts/connect", {
        method: "POST",
      });
    });
    expect(
      await screen.findByText(/Admin setup needed/i)
    ).toBeInTheDocument();
  });
});
