import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Lightweight version of portfolio fetch for OG image generation.
// We fetch token prices + balances for a quick summary without pulling
// the full lending/LP/vault data (too slow for OG generation).

async function fetchOgData(address: string) {
  const rpc = "https://rpc.monad.xyz";

  // Fetch MON balance + price in parallel
  const [balRes, priceRes] = await Promise.all([
    fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [address, "latest"],
      }),
    }),
    fetch("https://coins.llama.fi/prices/current/coingecko:monad", {
      next: { revalidate: 120 },
    }),
  ]);

  let monBalance = 0;
  let monPrice = 0;

  try {
    const balData = await balRes.json();
    monBalance = parseInt(balData.result || "0", 16) / 1e18;
  } catch {}

  try {
    const priceData = await priceRes.json();
    monPrice = priceData.coins?.["coingecko:monad"]?.price || 0;
  } catch {}

  const totalValue = monBalance * monPrice;

  return {
    address,
    monBalance,
    monPrice,
    totalValue,
  };
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return "$" + (value / 1_000_000).toFixed(2) + "M";
  if (value >= 1_000) return "$" + (value / 1_000).toFixed(2) + "K";
  if (value >= 1) return "$" + value.toFixed(2);
  return "$" + value.toFixed(4);
}

function shortenAddr(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");

  // Default OG image (no address)
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #0D0B1A 0%, #1a1535 50%, #0D0B1A 100%)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #6D3BF5, #0EA5A0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                fontWeight: 800,
                color: "white",
              }}
            >
              OP
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "36px", fontWeight: 700, color: "#E8E8FF" }}>
                Onchain Pulse
              </div>
              <div style={{ fontSize: "16px", color: "#5A5A74" }}>
                Monad Portfolio Tracker
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: "18px",
              color: "#A0A0B8",
              maxWidth: "500px",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Track your DeFi positions across the Monad ecosystem. Staking, lending, LP, vaults, and tokens.
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // Portfolio OG image
  const data = await fetchOgData(address);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0D0B1A 0%, #1a1535 50%, #0D0B1A 100%)",
          fontFamily: "system-ui, sans-serif",
          padding: "60px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "40px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #6D3BF5, #0EA5A0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                fontWeight: 800,
                color: "white",
              }}
            >
              OP
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "#E8E8FF" }}>
              Onchain Pulse
            </div>
          </div>
          <div
            style={{
              fontSize: "16px",
              color: "#5A5A74",
              fontFamily: "monospace",
            }}
          >
            {shortenAddr(address)}
          </div>
        </div>

        {/* Main value */}
        <div style={{ display: "flex", flexDirection: "column", marginBottom: "40px" }}>
          <div style={{ fontSize: "14px", color: "#5A5A74", letterSpacing: "1px", marginBottom: "8px" }}>
            PORTFOLIO VALUE
          </div>
          <div style={{ fontSize: "64px", fontWeight: 700, color: "#E8E8FF" }}>
            {formatUsd(data.totalValue)}
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: "40px",
            marginTop: "auto",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "13px", color: "#5A5A74", marginBottom: "4px" }}>
              MON BALANCE
            </div>
            <div style={{ fontSize: "28px", fontWeight: 600, color: "#A78BFA" }}>
              {data.monBalance >= 1000
                ? (data.monBalance / 1000).toFixed(1) + "K"
                : data.monBalance.toFixed(2)}{" "}
              MON
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "13px", color: "#5A5A74", marginBottom: "4px" }}>
              MON PRICE
            </div>
            <div style={{ fontSize: "28px", fontWeight: 600, color: "#14B8A6" }}>
              ${data.monPrice.toFixed(2)}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginLeft: "auto",
              alignItems: "flex-end",
            }}
          >
            <div style={{ fontSize: "13px", color: "#5A5A74", marginBottom: "4px" }}>
              POWERED BY
            </div>
            <div style={{ fontSize: "20px", fontWeight: 600, color: "#3A3A54" }}>
              onchain-pulse.vercel.app
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
