import { describe, it, expect } from "vitest";
import {
  formatUsd,
  formatNumber,
  formatPercent,
  shortenAddress,
  isValidEvmAddress,
} from "@/lib/format";

describe("formatUsd", () => {
  it("uses M suffix above 1 million", () => {
    expect(formatUsd(1_500_000)).toBe("$1.50M");
    expect(formatUsd(123_456_789)).toBe("$123.46M");
  });

  it("uses K suffix above 1 thousand and below 1 million", () => {
    expect(formatUsd(1_500)).toBe("$1.50K");
    expect(formatUsd(74_930)).toBe("$74.93K");
  });

  it("uses 2 decimals between 1 and 1000", () => {
    expect(formatUsd(123.456)).toBe("$123.46");
    expect(formatUsd(1)).toBe("$1.00");
  });

  it("uses 4 decimals below 1", () => {
    expect(formatUsd(0.006)).toBe("$0.0060");
    expect(formatUsd(0.12345)).toBe("$0.1235");
  });
});

describe("formatNumber", () => {
  it("uses M suffix for millions", () => {
    expect(formatNumber(1_330_000)).toBe("1.33M");
  });

  it("uses K suffix for thousands", () => {
    expect(formatNumber(3_440)).toBe("3.44K");
  });

  it("respects custom decimals below 1000", () => {
    expect(formatNumber(2.7345, 2)).toBe("2.73");
    expect(formatNumber(0.170100, 6)).toBe("0.170100");
  });
});

describe("formatPercent", () => {
  it("renders one decimal", () => {
    expect(formatPercent(15.8)).toBe("15.8%");
    expect(formatPercent(0)).toBe("0.0%");
  });
});

describe("shortenAddress", () => {
  it("keeps the 0x prefix and last 4 chars", () => {
    expect(shortenAddress("0x02964135319494d129F62e319Af7dE923Cb45B6F"))
      .toBe("0x0296...5B6F");
  });
});

describe("isValidEvmAddress", () => {
  it("accepts valid checksummed addresses", () => {
    expect(isValidEvmAddress("0x02964135319494d129F62e319Af7dE923Cb45B6F"))
      .toBe(true);
  });

  it("accepts all-lowercase addresses", () => {
    expect(isValidEvmAddress("0x02964135319494d129f62e319af7de923cb45b6f"))
      .toBe(true);
  });

  it("rejects missing 0x prefix", () => {
    expect(isValidEvmAddress("02964135319494d129F62e319Af7dE923Cb45B6F"))
      .toBe(false);
  });

  it("rejects too-short addresses", () => {
    expect(isValidEvmAddress("0x123")).toBe(false);
  });

  it("rejects too-long addresses", () => {
    expect(isValidEvmAddress("0x02964135319494d129F62e319Af7dE923Cb45B6F00"))
      .toBe(false);
  });

  it("rejects garbage strings", () => {
    expect(isValidEvmAddress("not-an-address")).toBe(false);
    expect(isValidEvmAddress("")).toBe(false);
  });

  it("rejects addresses with non-hex characters", () => {
    expect(isValidEvmAddress("0xZZ964135319494d129F62e319Af7dE923Cb45B6F"))
      .toBe(false);
  });
});
