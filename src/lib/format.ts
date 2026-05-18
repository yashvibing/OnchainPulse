// ─── Display Formatting Utilities ───

export function formatUsd(value: number): string {
  if (value >= 1_000_000) return "$" + (value / 1_000_000).toFixed(2) + "M";
  if (value >= 1_000) return "$" + (value / 1_000).toFixed(2) + "K";
  if (value >= 1) return "$" + value.toFixed(2);
  return "$" + value.toFixed(4);
}

export function formatUsdEstimate(value: number): string {
  if (value <= 0) return "$0";
  if (value < 0.01) return "<$0.01";
  if (value < 1) return "$" + value.toFixed(2);
  return formatUsd(value);
}

export function getPeriodicYieldEstimate(valueUsd: number, dailyUsd: number) {
  const period = valueUsd >= 10_000 ? "daily" : "weekly";
  const amount = period === "daily" ? dailyUsd : dailyUsd * 7;

  return {
    period,
    amount,
    label: `Estimated ${period} amount`,
    shortLabel: `Est. ${period}`,
    formatted: formatUsdEstimate(amount),
  };
}

export function formatNumber(value: number, decimals: number = 2): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + "M";
  if (value >= 1_000) return (value / 1_000).toFixed(2) + "K";
  return value.toFixed(decimals);
}

export function formatPercent(value: number): string {
  return value.toFixed(1) + "%";
}

export function shortenAddress(address: string): string {
  return address.slice(0, 6) + "..." + address.slice(-4);
}

export function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
