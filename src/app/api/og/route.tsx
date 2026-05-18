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

function parseData(d: string | null) {
  if (!d || d.length < 42) return null;

  if (d.includes("|")) {
    const [addr, value, dailyYield, positions, protocols] = d.split("|");
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
    return {
      address: addr,
      value: Number.parseFloat(value || "0") || 0,
      dailyYield: Number.parseFloat(dailyYield || "0") || 0,
      positions: Number.parseInt(positions || "0", 10) || 0,
      protocols: Number.parseInt(protocols || "0", 10) || 0,
    };
  }

  const addr = d.slice(0, 42);
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
  const value = d.length > 43 && d[42] === "S" ? parseInt(d.slice(43)) || 0 : 0;
  return { address: addr, value, dailyYield: 0, positions: 0, protocols: 0 };
}

export function GET(req: NextRequest) {
  const data = parseData(req.nextUrl.searchParams.get("d"));
  const logoUrl = new URL("/onchainpulse-mark.png", req.nextUrl.origin).toString();

  if (!data) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(135deg,#0D0B1A,#1a1535,#0D0B1A)", fontFamily: "system-ui", padding: "60px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "40px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", backgroundImage: `url(${logoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
            <div style={{ fontSize: "28px", fontWeight: 700, color: "#E8E8FF" }}>Onchain Pulse</div>
          </div>
          <div style={{ fontSize: "22px", color: "#A0A0B8", maxWidth: "600px", lineHeight: 1.6, flex: 1 }}>Explore public wallet portfolios and displayed DeFi rates relating to Monad.</div>
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
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundImage: `url(${logoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
            <div style={{ fontSize: "24px", fontWeight: 700, color: "#E8E8FF" }}>Onchain Pulse</div>
          </div>
          <div style={{ fontSize: "18px", color: "#A0A0B8", fontFamily: "monospace" }}>{short(data.address)}</div>
        </div>

        <div style={{ fontSize: "14px", color: "#86A79B", letterSpacing: "1.5px", marginBottom: "10px" }}>MONAD PORTFOLIO VALUE</div>
        <div style={{ fontSize: "68px", fontWeight: 700, color: "#F4FFF9", lineHeight: 1 }}>{data.value > 0 ? fmtUsd(data.value) : "View Portfolio"}</div>

        <div style={{ display: "flex", gap: "16px", marginTop: "42px" }}>
          <div style={{ width: "210px", border: "1px solid rgba(130,255,186,0.22)", background: "rgba(130,255,186,0.08)", borderRadius: "18px", padding: "20px" }}>
            <div style={{ fontSize: "13px", color: "#86A79B", marginBottom: "8px" }}>RATE ESTIMATE</div>
            <div style={{ fontSize: "30px", fontWeight: 800, color: "#00E87B" }}>{fmtUsd(data.dailyYield)}</div>
          </div>
          <div style={{ width: "210px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", borderRadius: "18px", padding: "20px" }}>
            <div style={{ fontSize: "13px", color: "#86A79B", marginBottom: "8px" }}>POSITIONS</div>
            <div style={{ fontSize: "30px", fontWeight: 800, color: "#F4FFF9" }}>{data.positions}</div>
          </div>
          <div style={{ width: "210px", border: "1px solid rgba(167,139,250,0.22)", background: "rgba(167,139,250,0.08)", borderRadius: "18px", padding: "20px" }}>
            <div style={{ fontSize: "13px", color: "#86A79B", marginBottom: "8px" }}>PROTOCOLS</div>
            <div style={{ fontSize: "30px", fontWeight: 800, color: "#A78BFA" }}>{data.protocols}</div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: "18px", color: "#5A5A74" }}>Monad Wallet View</div>
          <div style={{ fontSize: "16px", color: "#3A3A54" }}>onchain-pulse.vercel.app</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
