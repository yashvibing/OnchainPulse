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
  MUBOND: "/token-logos/mubond.svg",
  LOAZND: "/token-logos/loaznd.svg",
  SYZUSD: "/token-logos/syzusd.svg",
  AZND: "/token-logos/aznd.svg",
  WSRUSD: "/token-logos/wsrusd.svg",
  YZM: "/token-logos/yzm.svg",
  AHYPER: "/token-logos/ahyper.svg",
  AUTORANGE: "/token-logos/autorange.png",
  CETES: "/token-logos/cetes.png",
  DUST: "/token-logos/dust.svg",
  FXRP: "/token-logos/fxrp.svg",
  FUSDLP: "/token-logos/fusdlp.svg",
  MHYPER: "/token-logos/mhyper.svg",
  SHUSD: "/token-logos/shusd.png",
  ULRWA: "/token-logos/ulrwa.png",
  URRWA: "/token-logos/urrwa.png",
  VEDUST: "/token-logos/vedust.svg",
  YZPRIME: "/token-logos/yzprime.svg",
};

function cleanSymbol(symbol: string) {
  const normalized = symbol
    .trim()
    .toUpperCase()
    .replace(/\u20ae/g, "T")
    .replace(/-\d+(?:-DEBT)?$/u, "")
    .replace(/-DEBT$/u, "");

  if (normalized.startsWith("USD") && normalized.endsWith("0") && normalized.includes("T")) {
    return "USDT0";
  }

  return normalized;
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
  if (cleaned.includes("MUBOND")) return "MUBOND";
  if (cleaned.includes("LOAZND")) return "LOAZND";
  if (cleaned.includes("SYZUSD")) return "SYZUSD";
  if (cleaned.includes("AZND")) return "AZND";
  if (cleaned.includes("WSRUSD")) return "WSRUSD";
  if (cleaned.includes("YZPRIME")) return "YZPRIME";
  if (cleaned.includes("YZM")) return "YZM";
  if (cleaned.includes("AHYPER")) return "AHYPER";
  if (cleaned.includes("MHYPER")) return "MHYPER";
  if (cleaned.includes("AUTORANGE")) return "AUTORANGE";
  if (cleaned.includes("CETES")) return "CETES";
  if (cleaned.includes("FUSDLP")) return "FUSDLP";
  if (cleaned.includes("FXRP")) return "FXRP";
  if (cleaned.includes("SHUSD")) return "SHUSD";
  if (cleaned.includes("ULRWA")) return "ULRWA";
  if (cleaned.includes("URRWA")) return "URRWA";
  if (cleaned.includes("VEDUST")) return "VEDUST";
  if (cleaned.includes("DUST")) return "DUST";
  if (
    cleaned === "WNWMON" ||
    cleaned === "CWMON" ||
    cleaned === "EWMON" ||
    cleaned === "EEWMON"
  ) {
    return "WMON";
  }
  if (cleaned === "MON") return "WMON";

  return cleaned;
}

export function getTokenLogoSrc(symbol: string) {
  return TOKEN_LOGOS[normalizeTokenLogoSymbol(symbol)] || null;
}
