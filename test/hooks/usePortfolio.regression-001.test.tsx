// Regression: ISSUE-001 — Total Value double-counted LST tokens
// Found by /qa on 2026-04-11
// Report: .gstack/qa-reports/qa-report-monfolio-2026-04-11.md
//
// The bug: usePortfolio summed totalTokenValue + totalStakingValue. shMON
// (a liquid staking token) appeared in BOTH the token balances AND as a
// FastLane staking position, so its value was counted twice. The displayed
// total was roughly 2x reality.
//
// The fix: in usePortfolio, exclude tokens with category === "lst" from
// totalTokenValue, since their value is already counted via the matching
// staking position.
//
// What this test pins down:
//   - LST tokens MUST NOT contribute to totalValue
//   - Non-LST tokens MUST contribute to totalValue
//   - Staking positions MUST contribute to totalValue
//   - Adding more LSTs (e.g. when wiring Kintsu/Magma) must not regress

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

// Mock all five service modules BEFORE importing the hook
vi.mock("@/services/tokens", () => ({
  fetchTokenBalances: vi.fn(),
  fetchTokenPrices: vi.fn(),
  fetchTokenChanges24h: vi.fn(),
}));
vi.mock("@/services/staking", () => ({
  fetchStakingPositions: vi.fn(),
}));
vi.mock("@/services/vaults", () => ({
  fetchVaultPositions: vi.fn(),
}));
vi.mock("@/services/lending", () => ({
  fetchLendingPositions: vi.fn(),
}));
vi.mock("@/services/liquidity", () => ({
  fetchLiquidityPositions: vi.fn(),
}));
vi.mock("@/services/yields", () => ({
  fetchMonadYields: vi.fn(),
}));

import { usePortfolio } from "@/hooks/usePortfolio";
import { fetchTokenBalances } from "@/services/tokens";
import { fetchStakingPositions } from "@/services/staking";
import { fetchVaultPositions } from "@/services/vaults";
import { fetchLendingPositions } from "@/services/lending";
import { fetchLiquidityPositions } from "@/services/liquidity";
import type { TokenInfo } from "@/config/tokens";

const TEST_ADDRESS = "0x02964135319494d129F62e319Af7dE923Cb45B6F";

const SHMON_TOKEN: TokenInfo = {
  address: "0x1B68626dCa36c7fE922fD2d55E4f631d962dE19c",
  symbol: "shMON",
  name: "FastLane Staked MON",
  decimals: 18,
  category: "lst",
  logoColor: "#D97706",
};

const APRMON_TOKEN: TokenInfo = {
  address: "0x0c65A0BC65a5D819235B71F554D210D3F80E0852",
  symbol: "aprMON",
  name: "aPriori Staked MON",
  decimals: 18,
  category: "lst",
  logoColor: "#6D28D9",
};

const AUSD_TOKEN: TokenInfo = {
  address: "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a",
  symbol: "AUSD",
  name: "Agora USD",
  decimals: 6,
  category: "stablecoin",
  logoColor: "#1A73E8",
};

const NATIVE_MON_TOKEN: TokenInfo = {
  address: "0x0000000000000000000000000000000000000000",
  symbol: "MON",
  name: "Monad",
  decimals: 18,
  category: "native",
  logoColor: "#6D3BF5",
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.mocked(fetchVaultPositions).mockResolvedValue([]);
  vi.mocked(fetchLendingPositions).mockResolvedValue([]);
  vi.mocked(fetchLiquidityPositions).mockResolvedValue([]);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith("/api/portfolio/")) {
        const [tokens, staking, vaults, lending, liquidity] = await Promise.all([
          vi.mocked(fetchTokenBalances)(TEST_ADDRESS as `0x${string}`),
          vi.mocked(fetchStakingPositions)(TEST_ADDRESS as `0x${string}`),
          vi.mocked(fetchVaultPositions)(TEST_ADDRESS as `0x${string}`),
          vi.mocked(fetchLendingPositions)(TEST_ADDRESS as `0x${string}`),
          vi.mocked(fetchLiquidityPositions)(TEST_ADDRESS as `0x${string}`),
        ]);

        return {
          ok: true,
          json: async () => ({
            tokens: tokens.map((token) => ({
              ...token,
              balance: token.balance.toString(),
            })),
            staking,
            vaults,
            lending,
            liquidity,
            updatedAt: Date.now(),
          }),
        } as Response;
      }

      return {
        ok: false,
        json: async () => ({}),
      } as Response;
    })
  );
});

describe("usePortfolio — ISSUE-001 LST double-count regression", () => {
  it("excludes LST tokens from totalValue (the original bug)", async () => {
    // Demo wallet scenario: 1.33M shMON + AUSD + native MON,
    // and one matching FastLane staking position holding the same shMON.
    vi.mocked(fetchTokenBalances).mockResolvedValue([
      {
        token: SHMON_TOKEN,
        balance: 1_330_000n * 10n ** 18n,
        formatted: "1330000",
        priceUsd: 54.42,
        valueUsd: 72_180,
        change24h: 0.1,
      },
      {
        token: AUSD_TOKEN,
        balance: 1250n * 10n ** 6n,
        formatted: "1250",
        priceUsd: 1,
        valueUsd: 1250,
        change24h: 0,
      },
      {
        token: NATIVE_MON_TOKEN,
        balance: 273n * 10n ** 17n,
        formatted: "27.3",
        priceUsd: 35.5,
        valueUsd: 96.82,
        change24h: 1.4,
      },
    ]);
    vi.mocked(fetchStakingPositions).mockResolvedValue([
      {
        protocol: "FastLane",
        lstSymbol: "shMON",
        lstBalance: "1330000",
        monEquivalent: "2046604",
        exchangeRate: 1.5388,
        stakedValueUsd: 72_720, // ← same shMON, valued via convertToAssets
        apy: 15.8,
        color: "#D97706",
      },
    ]);

    const { result } = renderHook(() => usePortfolio(TEST_ADDRESS), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Math: AUSD 1250 + MON 96.82 + FastLane 72720 = 74066.82
    // BUG would have been: + shMON token 72180 = 146246.82 (almost 2x)
    expect(result.current.totalValue).toBeCloseTo(74_066.82, 1);

    // The bug: this assertion would have FAILED with the old code,
    // because totalValue would have been ~$146K instead of ~$74K.
    expect(result.current.totalValue).toBeLessThan(100_000);
    expect(result.current.totalValue).toBeGreaterThan(50_000);
  });

  it("keeps LST tokens visible in the tokens array (Tokens tab still shows them)", async () => {
    vi.mocked(fetchTokenBalances).mockResolvedValue([
      {
        token: SHMON_TOKEN,
        balance: 1n,
        formatted: "1",
        priceUsd: 54.42,
        valueUsd: 54.42,
        change24h: null,
      },
    ]);
    vi.mocked(fetchStakingPositions).mockResolvedValue([]);

    const { result } = renderHook(() => usePortfolio(TEST_ADDRESS), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Visibility: shMON still appears in tokens for the Tokens tab.
    expect(result.current.tokens).toHaveLength(1);
    expect(result.current.tokens[0].token.symbol).toBe("shMON");
    // But its $54.42 should NOT be in totalValue (no staking position to dedupe against,
    // but the rule is unconditional: LSTs are owned by the staking column).
    expect(result.current.totalValue).toBe(0);
  });

  it("handles multiple LSTs without double-counting any of them", async () => {
    // Forward-looking: when Kintsu (kMON) and Magma (gMON) are wired,
    // each new LST entry must follow the same rule. This test pins it.
    vi.mocked(fetchTokenBalances).mockResolvedValue([
      {
        token: SHMON_TOKEN,
        balance: 100n,
        formatted: "100",
        priceUsd: 50,
        valueUsd: 5_000,
        change24h: null,
      },
      {
        token: APRMON_TOKEN,
        balance: 200n,
        formatted: "200",
        priceUsd: 50,
        valueUsd: 10_000,
        change24h: null,
      },
      {
        token: AUSD_TOKEN,
        balance: 1000n * 10n ** 6n,
        formatted: "1000",
        priceUsd: 1,
        valueUsd: 1_000,
        change24h: null,
      },
    ]);
    vi.mocked(fetchStakingPositions).mockResolvedValue([
      {
        protocol: "FastLane",
        lstSymbol: "shMON",
        lstBalance: "100",
        monEquivalent: "153.88",
        exchangeRate: 1.5388,
        stakedValueUsd: 5_100,
        apy: 15.8,
        color: "#D97706",
      },
      {
        protocol: "aPriori",
        lstSymbol: "aprMON",
        lstBalance: "200",
        monEquivalent: "204",
        exchangeRate: 1.018,
        stakedValueUsd: 10_200,
        apy: 17.2,
        color: "#6D28D9",
      },
    ]);

    const { result } = renderHook(() => usePortfolio(TEST_ADDRESS), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Correct: AUSD 1000 + FastLane 5100 + aPriori 10200 = 16300
    // Bug would give: + shMON 5000 + aprMON 10000 = 31300 (nearly 2x)
    expect(result.current.totalValue).toBe(16_300);
    expect(result.current.staking).toHaveLength(2);
  });

  it("counts non-LST tokens normally", async () => {
    // Sanity check: stablecoins, native, wrapped tokens still count.
    vi.mocked(fetchTokenBalances).mockResolvedValue([
      {
        token: AUSD_TOKEN,
        balance: 5000n * 10n ** 6n,
        formatted: "5000",
        priceUsd: 1,
        valueUsd: 5_000,
        change24h: null,
      },
      {
        token: NATIVE_MON_TOKEN,
        balance: 100n * 10n ** 18n,
        formatted: "100",
        priceUsd: 35,
        valueUsd: 3_500,
        change24h: null,
      },
    ]);
    vi.mocked(fetchStakingPositions).mockResolvedValue([]);

    const { result } = renderHook(() => usePortfolio(TEST_ADDRESS), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.totalValue).toBe(8_500);
  });
});
