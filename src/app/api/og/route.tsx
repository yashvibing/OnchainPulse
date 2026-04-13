import { ImageResponse } from "next/og";
import { type NextRequest, NextResponse } from "next/server";

// Node runtime — more reliable for external fetches than edge
export const runtime = "nodejs";

function short(a: string) {
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function fmtUsd(v: number): string {
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(2) + "K";
  if (v >= 1) return "$" + v.toFixed(2);
  if (v > 0) return "$" + v.toFixed(4);
  return "$0.00";
}

async function getPortfolioSummary(address: string) {
  let monBalance = 0;
  let monPrice = 0;

  try {
    const [balRes, priceRes] = await Promise.all([
      fetch("https://rpc.monad.xyz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "eth_getBalance",
          params: [address, "latest"],
        }),
      }),
      fetch("https://coins.llama.fi/prices/current/coingecko:monad"),
    ]);

    if (balRes.ok) {
      const d = await balRes.json();
      monBalance = parseInt(d.result || "0", 16) / 1e18;
    }
    if (priceRes.ok) {
      const d = await priceRes.json();
      monPrice = d.coins?.["coingecko:monad"]?.price || 0;
    }
  } catch {
    // Continue with zeros
  }

  return { monBalance, monPrice, totalValue: monBalance * monPrice };
}

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get("address");
    const hasAddr = address && /^0x[a-fA-F0-9]{40}$/.test(address);

    if (!hasAddr) {
      return new ImageResponse(
        (
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(135deg,#0D0B1A,#1a1535,#0D0B1A)", fontFamily: "system-ui", padding: "60px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "40px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "linear-gradient(135deg,#6D3BF5,#0EA5A0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 800, color: "white" }}>OP</div>
              <div style={{ fontSize: "28px", fontWeight: 700, color: "#E8E8FF" }}>Onchain Pulse</div>
            </div>
            <div style={{ fontSize: "22px", color: "#A0A0B8", maxWidth: "600px", lineHeight: 1.6, flex: 1 }}>Track your DeFi positions across the Monad ecosystem. Staking, lending, LP, vaults, and tokens.</div>
            <div style={{ fontSize: "16px", color: "#3A3A54" }}>onchain-pulse.vercel.app</div>
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    const data = await getPortfolioSummary(address);

    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(135deg,#0D0B1A,#1a1535,#0D0B1A)", fontFamily: "system-ui", padding: "60px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "48px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg,#6D3BF5,#0EA5A0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 800, color: "white" }}>OP</div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "#E8E8FF" }}>Onchain Pulse</div>
            </div>
            <div style={{ fontSize: "18px", color: "#A0A0B8", fontFamily: "monospace" }}>{short(address)}</div>
          </div>

          <div style={{ fontSize: "14px", color: "#5A5A74", letterSpacing: "1.5px", marginBottom: "12px" }}>PORTFOLIO VALUE</div>
          <div style={{ fontSize: "72px", fontWeight: 700, color: "#E8E8FF", marginBottom: "24px", lineHeight: 1 }}>{fmtUsd(data.totalValue)}</div>

          <div style={{ display: "flex", gap: "40px", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "13px", color: "#5A5A74", marginBottom: "4px" }}>MON BALANCE</div>
              <div style={{ fontSize: "28px", fontWeight: 600, color: "#A78BFA" }}>{data.monBalance >= 1000 ? (data.monBalance / 1000).toFixed(1) + "K" : data.monBalance.toFixed(2)} MON</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "13px", color: "#5A5A74", marginBottom: "4px" }}>MON PRICE</div>
              <div style={{ fontSize: "28px", fontWeight: 600, color: "#14B8A6" }}>${data.monPrice.toFixed(2)}</div>
            </div>
          </div>

          <div style={{ fontSize: "16px", color: "#3A3A54", textAlign: "right" }}>onchain-pulse.vercel.app</div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
