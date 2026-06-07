import { describe, expect, it } from "vitest";
import {
  calculateAverageBlockTimeSeconds,
  calculateEstimatedBurnRateMonPerDay,
  pickMonMarketStats,
} from "@/services/analytics";

describe("analytics helpers", () => {
  it("averages block time across a window so sub-second chains do not render as zero", () => {
    expect(calculateAverageBlockTimeSeconds(1_780_819_744n, 1_780_819_704n, 100n))
      .toBe(0.4);
  });

  it("estimates daily burn from sampled base-fee burn", () => {
    expect(calculateEstimatedBurnRateMonPerDay(100_000_000_000_000_000_000n, 100n, 0.4))
      .toBe(216000);
  });

  it("uses native MON market data before wrapped-token fallback data", () => {
    expect(
      pickMonMarketStats(
        { priceUsd: 0.023, marketCapUsd: 271_969_776, fdvUsd: 2_315_630_482 },
        { priceUsd: 0.023, marketCapUsd: 9_677_902, fdvUsd: 8_036_004 },
        { priceUsd: 0.022, marketCapUsd: undefined, fdvUsd: 2_299_924_000 }
      )
    ).toEqual({
      priceUsd: 0.023,
      marketCapUsd: 271_969_776,
      fdvUsd: 2_315_630_482,
      volume24hUsd: undefined,
      change24hPct: undefined,
      totalSupplyMon: undefined,
      circulatingSupplyMon: undefined,
    });
  });

  it("falls back to pool market data when direct token stats omit fields", () => {
    expect(
      pickMonMarketStats(
        {},
        { priceUsd: 0.023 },
        { priceUsd: 0.022, marketCapUsd: 8_000_000, fdvUsd: 2_299_924_000 }
      )
    ).toEqual({
      priceUsd: 0.023,
      marketCapUsd: 8_000_000,
      fdvUsd: 2_299_924_000,
      volume24hUsd: undefined,
      change24hPct: undefined,
      totalSupplyMon: undefined,
      circulatingSupplyMon: undefined,
    });
  });

  it("derives market cap from native circulating supply when CoinGecko omits market cap", () => {
    expect(
      pickMonMarketStats(
        { priceUsd: 0.02, circulatingSupplyMon: 10_000_000_000 },
        { marketCapUsd: 9_677_902 }
      ).marketCapUsd
    ).toBe(200_000_000);
  });
});
