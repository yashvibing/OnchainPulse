import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AlertCreator } from "@/components/AlertCreator";
import { AlertManagement } from "@/components/AlertManagement";
import { TELEGRAM_IDENTITY_STORAGE_KEY } from "@/lib/telegramAlertClient";

vi.mock("@/services/yields-aggregator", () => ({
  fetchYieldOpportunitiesWithClientMeta: vi.fn(async () => ({ data: [] })),
  getOpportunityAssetSymbols: vi.fn(() => []),
}));

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/alerts") {
        return {
          ok: true,
          json: async () => ({ configured: true, botUsername: "onchainpulsebot" }),
        };
      }
      if (url === "/api/token-markets") {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        };
      }
      if (url === "/api/alerts/connect") {
        return {
          ok: true,
          json: async () => ({
            code: "ocp_testcode",
            deepLink: "https://t.me/onchainpulsebot?start=ocp_testcode",
            expiresAt: Date.now() + 60_000,
          }),
        };
      }

      return {
        ok: false,
        json: async () => ({ error: "Unexpected request" }),
      };
    })
  );
});

describe("Telegram connection CTA", () => {
  it("starts Telegram link creation from the connection step", async () => {
    window.localStorage.setItem(
      TELEGRAM_IDENTITY_STORAGE_KEY,
      JSON.stringify({
        id: "123",
        loginToken: "login-token",
        username: "tester",
        connectedAt: Date.now(),
      })
    );

    render(
      <>
        <AlertCreator />
        <AlertManagement />
      </>
    );

    const button = await screen.findByRole("button", {
      name: "Create bot link",
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/alerts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginToken: "login-token" }),
      });
    });
    expect(await screen.findByRole("link", { name: "Launch bot link" })).toHaveAttribute(
      "href",
      "https://t.me/onchainpulsebot?start=ocp_testcode"
    );
  });
});
