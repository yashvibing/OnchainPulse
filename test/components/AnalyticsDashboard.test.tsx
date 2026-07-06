import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";

const DAY_MS = 86_400_000;

function trend(values: number[]) {
  const now = Date.now();
  return values.map((value, index) => ({
    timestamp: now - (values.length - 1 - index) * DAY_MS,
    value,
  }));
}

const payload = {
  generatedAt: Date.now(),
  sources: ["DefiLlama"],
  market: {
    priceUsd: 0.0218,
    change24hPct: 4.3,
    marketCapUsd: 257_710_000,
    fdvUsd: 2_190_000_000,
    volume24hUsd: 296_460_000,
    priceTrend: trend([0.02, 0.021, 0.0218]),
  },
  supply: { totalSupplyMon: 100_000_000_000, circulatingSupplyMon: 11_800_000_000 },
  staking: {
    activeValidators: 198,
    activeSetCap: 200,
    totalActiveStakeMon: 15_070_000_000,
    totalValueStakedUsd: 328_380_000,
    estimatedApyPct: 9.6,
    minApyPct: 0.4,
    maxApyPct: 30.1,
  },
  network: { activeAddresses: 24_279 },
  economy: {
    dailyFeesUsd: 42_600,
    chainFeesUsd: 3_900,
    chainRevenueUsd: 3_100,
    chainRevUsd: 3_900,
    tokenIncentivesUsd: 0,
    appRevenueUsd: 9_200,
    appFeesUsd: 33_500,
    annualizedFeesUsd: 15_540_000,
    psRatio: 16.6,
    pfRatio: 18,
    feeTrend: trend([40_000, 41_000, 42_600]),
    chainRevenueTrend: trend([3_000, 3_050, 3_100]),
    appRevenueTrend: trend([9_000, 9_100, 9_200]),
    appFeesTrend: trend([30_000, 32_000, 33_500]),
    userFeesTrend: trend([40_000, 41_500, 42_600]),
  },
  decentralization: {
    nakamotoSafety: 22,
    top10SharePct: 25.2,
    countries: [],
    providers: [],
  },
  defi: {
    totalTvlUsd: 469_760_000,
    totalChainTvlUsd: 469_760_000,
    protocolTvl: [{ label: "Curvance", value: 100_000_000 }],
    categoryTvl: [],
    topRates: [{ label: "aPriori", value: 17.2 }],
    topDexLiquidity: [],
    totalRaisedUsd: 513_000_000,
    bridgedTvlUsd: 711_540_000,
    rwaActiveMcapUsd: 214_300_000,
    tvlTrend: trend([450_000_000, 460_000_000, 469_760_000]),
    volume30dTrend: [],
  },
  stablecoins: {
    totalUsd: 486_990_000,
    trend: trend([470_000_000, 480_000_000, 486_990_000]),
    assets: [{ symbol: "USDC", valueUsd: 228_000_000, sharePct: 47 }],
  },
  derivatives: { perpsVolume24hUsd: 5_650_000, perpsVolumeTrend: [] },
  flows: { netInflows24hUsd: 49_500, netInflowsTrend: [] },
  dex: {
    volume24hUsd: 30_120_000,
    volume7dUsd: 131_100_000,
    volume30dUsd: 500_000_000,
    tvlUsd: 54_070_000,
    volumeToTvlPct: 55.7,
    volumeTrend: trend([28_000_000, 29_000_000, 30_120_000]),
    feeTrend: trend([40_000, 41_000, 42_600]),
    topProtocols: [{ label: "Kuru", value: 10_000_000 }],
  },
  validators: [],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: payload, meta: { cache: "hit", fetchedAt: Date.now(), sources: ["DefiLlama"] } }),
    }))
  );
});

async function openPicker() {
  fireEvent.click(await screen.findByRole("button", { name: /Add metrics/u }));
  return screen.getByRole("dialog", { name: "Chart metrics" });
}

describe("AnalyticsDashboard metric picker", () => {
  it("lists only metrics that have chart history", async () => {
    render(<AnalyticsDashboard />);
    const dialog = await openPicker();

    // Chartable metrics (trend data in the payload) are offered.
    expect(within(dialog).getByRole("button", { name: /DEX volume/u })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "App fees" })).toBeInTheDocument();

    // Snapshot-only metrics (no trend points) must not be offered.
    expect(within(dialog).queryByRole("button", { name: "Validators" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Bridged TVL" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Perps volume" })).not.toBeInTheDocument();

    // Removed metrics must not exist at all.
    expect(within(dialog).queryByRole("button", { name: "MON price" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Market cap" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "FDV" })).not.toBeInTheDocument();
  });

  it("closes via the close button and via clicking outside", async () => {
    render(<AnalyticsDashboard />);

    const dialog = await openPicker();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close metric picker" }));
    expect(screen.queryByRole("dialog", { name: "Chart metrics" })).not.toBeInTheDocument();

    await openPicker();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog", { name: "Chart metrics" })).not.toBeInTheDocument();
  });

  it("stays open while toggling metrics and updates the selected pills", async () => {
    render(<AnalyticsDashboard />);
    const dialog = await openPicker();

    fireEvent.click(within(dialog).getByRole("button", { name: "App fees" }));
    expect(screen.getByRole("dialog", { name: "Chart metrics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove App fees from chart" })).toBeInTheDocument();
  });

  it("shows snapshot-only metrics in the network stats section", async () => {
    render(<AnalyticsDashboard />);
    await screen.findByText("Latest network stats");

    const section = screen.getByText("Latest network stats").closest("section") as HTMLElement;
    expect(within(section).getByText("Validators")).toBeInTheDocument();
    expect(within(section).getByText("Bridged TVL")).toBeInTheDocument();

    // The valuation section (P/S, P/F) was removed entirely.
    expect(screen.queryByText("Valuation")).not.toBeInTheDocument();
    expect(screen.queryByText("P/S")).not.toBeInTheDocument();
    expect(screen.queryByText("P/F")).not.toBeInTheDocument();
  });
});
