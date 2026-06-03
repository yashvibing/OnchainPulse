const TOKEN_LOGOS: Record<string, string> = {
  MON: "/monad-logomark.svg",
  WMON: "/monad-logomark.svg",
  USDC: "/token-logos/usdc.svg",
  AUSD: "/token-logos/ausd.svg",
  WBTC: "/token-logos/wbtc.svg",
  USDT0: "/token-logos/usdt0.svg",
  WETH: "/token-logos/weth.svg",
  USDM: "/token-logos/usdm.svg",
  SHMON: "/token-logos/shmon.png",
  SMON: "/token-logos/smon.svg",
  GMON: "/token-logos/gmon.svg",
  USD1: "/token-logos/usd1.svg",
  VUSD: "/token-logos/vusd.svg",
  CBBTC: "/token-logos/cbbtc.svg",
  APRMON: "/token-logos/aprmon.svg",
  EBTC: "/token-logos/ebtc.svg",
  ENZOBTC: "/token-logos/enzobtc.svg",
  WSTETH: "/token-logos/wsteth.svg",
  EZETH: "/token-logos/ezeth.svg",
  XAUT0: "/token-logos/xaut0.svg",
  GBPM: "/token-logos/gbpm.svg",
  EURM: "/token-logos/eurm.svg",
  JPYM: "/token-logos/jpym.svg",
  CHFM: "/token-logos/chfm.svg",
};

function cleanSymbol(symbol: string) {
  return symbol
    .trim()
    .toUpperCase()
    .replace(/USD₮0/gu, "USDT0")
    .replace(/-\d+(?:-DEBT)?$/u, "")
    .replace(/-DEBT$/u, "");
}

export function normalizeTokenLogoSymbol(symbol: string) {
  const cleaned = cleanSymbol(symbol);

  if (TOKEN_LOGOS[cleaned]) return cleaned;
  if (cleaned.includes("APRMON")) return "APRMON";
  if (cleaned.includes("SHMON")) return "SHMON";
  if (cleaned.includes("SMON")) return "SMON";
  if (cleaned.includes("GMON")) return "GMON";
  if (cleaned.includes("CBBTC")) return "CBBTC";
  if (cleaned.includes("ENZOBTC")) return "ENZOBTC";
  if (cleaned.includes("EBTC")) return "EBTC";
  if (cleaned.includes("WSTETH")) return "WSTETH";
  if (cleaned.includes("EZETH")) return "EZETH";
  if (cleaned.includes("USDT0")) return "USDT0";
  if (cleaned.includes("USDC")) return "USDC";
  if (cleaned.includes("AUSD")) return "AUSD";
  if (cleaned.includes("USD1")) return "USD1";
  if (cleaned.includes("USDM")) return "USDM";
  if (cleaned.includes("VUSD")) return "VUSD";
  if (cleaned.includes("WBTC") || cleaned.includes("BTC")) return "WBTC";
  if (cleaned.includes("WETH") || cleaned.includes("ETH")) return "WETH";
  if (cleaned.includes("XAUT0")) return "XAUT0";
  if (cleaned.includes("GBPM")) return "GBPM";
  if (cleaned.includes("EURM")) return "EURM";
  if (cleaned.includes("JPYM")) return "JPYM";
  if (cleaned.includes("CHFM")) return "CHFM";
  if (cleaned === "WNWMON" || cleaned === "CWMON" || cleaned === "EWMON" || cleaned === "EEWMON") return "WMON";
  if (cleaned === "MON") return "WMON";

  return cleaned;
}

export function getTokenLogoSrc(symbol: string) {
  return TOKEN_LOGOS[normalizeTokenLogoSymbol(symbol)] || null;
}
