import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "edge";

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

export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const address = p.get("address");
  const hasAddr = address && /^0x[a-fA-F0-9]{40}$/.test(address);

  // Stats encoded as single param: "value-yield-positions-protocols"
  const stats = p.get("s")?.split("-").map(Number) || [];
  const value = stats[0] || 0;
  const dailyYield = stats[1] || 0;
  const positions = stats[2] || 0;
  const protocols = stats[3] || 0;

  if (!hasAddr) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(135deg,#0D0B1A,#1a1535,#0D0B1A)", fontFamily: "system-ui", padding: "60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "40px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "linear-gradient(135deg,#6D3BF5,#0EA5A0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 800, color: "white" }}>OP</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#E8E8FF" }}>Onchain Pulse</div>
        </div>
        <div style={{ fontSize: "22px", color: "#A0A0B8", maxWidth: "600px", lineHeight: 1.6, flex: 1 }}>Track your DeFi positions across the Monad ecosystem. Staking, lending, LP, vaults, and tokens.</div>
        <div style={{ fontSize: "16px", color: "#3A3A54" }}>onchain-pulse.vercel.app</div>
      </div>,
      { width: 1200, height: 630 }
    );
  }

  const hasStats = value > 0;

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(135deg,#0D0B1A,#1a1535,#0D0B1A)", fontFamily: "system-ui", padding: "60px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg,#6D3BF5,#0EA5A0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 800, color: "white" }}>OP</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#E8E8FF" }}>Onchain Pulse</div>
        </div>
        <div style={{ fontSize: "18px", color: "#A0A0B8", fontFamily: "monospace" }}>{short(address)}</div>
      </div>

      <div style={{ fontSize: "64px", fontWeight: 700, color: "#E8E8FF", marginBottom: "12px" }}>{hasStats ? fmtUsd(value) : "View Portfolio"}</div>

      <div style={{ display: "flex", gap: "20px", fontSize: "18px", flex: 1 }}>
        {dailyYield > 0 && <div style={{ color: "#14B8A6" }}>+{fmtUsd(dailyYield)}/day</div>}
        {positions > 0 && <div style={{ color: "#A78BFA" }}>{positions} positions across {protocols} protocols</div>}
      </div>

      <div style={{ fontSize: "16px", color: "#3A3A54", textAlign: "right" }}>onchain-pulse.vercel.app</div>
    </div>,
    { width: 1200, height: 630 }
  );
}
