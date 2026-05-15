import { describe, expect, it } from "vitest";
import { buildWalletYieldMatches } from "@/lib/walletOpportunities";
import type { TokenBalance } from "@/services/tokens";
import type { YieldOpportunity } from "@/services/yields-aggregator";

function token(symbol: string, valueUsd: number): TokenBalance {
  return {
    token: {
      address: "0x0000000000000000000000000000000000000000",
      symbol,
      name: symbol,
      decimals: 18,
      category: "defi",
    },
    balance: 1n,
    formatted: "1",
    valueUsd,
    priceUsd: valueUsd,
    change24h: null,
  };
}

function opportunity(
  symbol: string,
  apr: number,
  opportunityType: YieldOpportunity["opportunityType"]
): YieldOpportunity {
  return {
    id: `${opportunityType}-${symbol}`,
    action: "LEND",
    source: "DefiLlama",
    opportunityType,
    name: `${opportunityType} ${symbol}`,
    protocol: opportunityType === "LP" ? "Curve Dex" : "Morpho",
    protocolIcon: "",
    protocolUrl: "",
    apr,
    tvl: 1000,
    dailyRewards: 0,
    tokens: [
      {
        symbol,
        address: "",
        decimals: 18,
        price: 1,
      },
    ],
    depositUrl: "https://example.com",
    status: "LIVE",
    tags: ["defillama-yield"],
    baseApr: apr,
    rewardApr: 0,
  };
}

describe("wallet yield matching", () => {
  it("does not recommend LP pools as idle single-asset lending matches", () => {
    // Regression: ISSUE-001 - idle holdings recommended LP pools as direct lending.
    // Found by /qa on 2026-05-15.
    // Report: .gstack/qa-reports/onchainpulse-2026-05-15/qa-report-onchainpulse-2026-05-15.md
    const matches = buildWalletYieldMatches(
      [token("sMON", 100)],
      [
        opportunity("sMON", 30, "LP"),
        opportunity("sMON", 5, "Lending"),
      ]
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].opportunity.protocol).toBe("Morpho");
    expect(matches[0].opportunity.opportunityType).toBe("Lending");
  });
});
