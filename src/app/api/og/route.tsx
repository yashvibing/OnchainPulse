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
  return "$0";
}

// Single "d" param: first 42 chars = address, after "S" = total value (integer)
// Format: "0x1234...abcd" or "0x1234...abcdS15420"
function parseData(d: string | null) {
  if (!d || d.length < 42) return null;
  const addr = d.slice(0, 42);
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
  const value = d.length > 43 && d[42] === "S" ? parseInt(d.slice(43)) || 0 : 0;
  return { address: addr, value };
}

export function GET(req: NextRequest) {
  const data = parseData(req.nextUrl.searchParams.get("d"));

  if (!data) {
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

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(135deg,#0D0B1A,#1a1535,#0D0B1A)", fontFamily: "system-ui", padding: "60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "44px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg,#6D3BF5,#0EA5A0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 800, color: "white" }}>OP</div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "#E8E8FF" }}>Onchain Pulse</div>
          </div>
          <div style={{ fontSize: "18px", color: "#A0A0B8", fontFamily: "monospace" }}>{short(data.address)}</div>
        </div>

        <div style={{ fontSize: "14px", color: "#5A5A74", letterSpacing: "1.5px", marginBottom: "10px" }}>PORTFOLIO VALUE</div>
        <div style={{ fontSize: "68px", fontWeight: 700, color: "#E8E8FF", lineHeight: 1 }}>{data.value > 0 ? fmtUsd(data.value) : "View Portfolio"}</div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: "18px", color: "#5A5A74" }}>Monad DeFi Portfolio</div>
          <div style={{ fontSize: "16px", color: "#3A3A54" }}>onchain-pulse.vercel.app</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
