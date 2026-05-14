import { describe, expect, it } from "vitest";
import {
  calculateLoopStrategies,
  filterBorrowOpportunities,
  filterByTokens,
  getBorrowCollateralSymbols,
  getOpportunityAssetSymbols,
  type YieldOpportunity,
} from "@/services/yields-aggregator";

function opportunity(
  action: "LEND" | "BORROW",
  tokens: string[],
  apr = 1
): YieldOpportunity {
  return {
    id: `${action}-${tokens.join("-")}`,
    action,
    source: "Merkl",
    opportunityType: action === "BORROW" ? "Borrow" : "Lending",
    name: `${action} ${tokens.join("/")}`,
    protocol: "Morpho",
    protocolIcon: "",
    protocolUrl: "",
    apr,
    tvl: 1000,
    dailyRewards: 10,
    tokens: tokens.map((symbol) => ({
      symbol,
      address: "0x0000000000000000000000000000000000000000",
      decimals: 18,
      price: 1,
    })),
    depositUrl: "https://example.com",
    status: "LIVE",
    tags: [],
    baseApr: 0,
    rewardApr: apr,
  };
}

describe("yield aggregator filtering", () => {
  it("filters vault opportunities by their underlying asset, not receipt token", () => {
    const opps = [
      opportunity("LEND", ["hyperUSDCd", "USDC"]),
      opportunity("LEND", ["steakETH", "WETH"]),
      opportunity("LEND", ["randomVaultShare"]),
    ];

    expect(getOpportunityAssetSymbols(opps[0])).toEqual(["USDC"]);
    expect(filterByTokens(opps, ["USDC"], "LEND")).toEqual([opps[0]]);
    expect(filterByTokens(opps, ["WETH"], "LEND")).toEqual([opps[1]]);
  });

  it("excludes unsupported assets from the default all-token view", () => {
    const opps = [
      opportunity("LEND", ["USDC"]),
      opportunity("LEND", ["randomVaultShare"]),
    ];

    expect(filterByTokens(opps, [], "LEND")).toEqual([opps[0]]);
  });

  it("includes DefiLlama yield pools in the default all-token view", () => {
    const defillamaPool = {
      ...opportunity("LEND", ["hyperUSDCa"]),
      source: "DefiLlama" as const,
      tags: ["defillama-yield"],
    };

    expect(filterByTokens([defillamaPool], [], "LEND")).toEqual([defillamaPool]);
  });

  it("labels loop strategies with the selected underlying symbols", () => {
    const strategies = calculateLoopStrategies(
      [
        opportunity("LEND", ["hyperUSDCd", "USDC"], 3),
        opportunity("BORROW", ["USDC"], 1),
      ],
      ["USDC"],
      ["USDC"]
    );

    expect(strategies[0]).toMatchObject({
      supplyToken: "USDC",
      borrowToken: "USDC",
      liquidationRisk: "low",
    });
  });

  it("shows borrow collateral and filters borrow opportunities by selected supply tokens", () => {
    const wethCollateralBorrow = {
      ...opportunity("BORROW", ["cUSDC", "USDC"], 1),
      name: "Borrow USDC from Curvance WETH/USDC market",
    };
    const genericBorrow = {
      ...opportunity("BORROW", ["USDC"], 1),
      name: "Borrow USDC on any Morpho Market",
    };

    expect(getBorrowCollateralSymbols(wethCollateralBorrow)).toEqual(["WETH"]);
    expect(filterBorrowOpportunities([wethCollateralBorrow], ["USDC"], ["AUSD"])).toEqual([]);
    expect(filterBorrowOpportunities([wethCollateralBorrow], ["USDC"], ["WETH"])).toEqual([
      wethCollateralBorrow,
    ]);
    expect(filterBorrowOpportunities([genericBorrow], ["USDC"], ["WETH"])).toEqual([
      genericBorrow,
    ]);
  });
});
