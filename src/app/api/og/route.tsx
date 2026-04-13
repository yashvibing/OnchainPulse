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

// v param format: "totalValue.positions.protocols.dailyYield"
function parseStats(v: string | null) {
  if (!v) return { value: 0, positions: 0, protocols: 0, dailyYield: 0 };
  const parts = v.split(".");
  return {
    value: parseFloat(parts[0]) || 0,
    positions: parseInt(parts[1]) || 0,
    protocols: parseInt(parts[2]) || 0,
    dailyYield: parseFloat(parts[3]) || 0,
  };
}

export function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const hasAddr = address && /^0x[a-fA-F0-9]{40}$/.test(address);
  const stats = parseStats(req.nextUrl.searchParams.get("v"));

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

  const hasStats = stats.value > 0;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(135deg,#0D0B1A,#1a1535,#0D0B1A)", fontFamily: "system-ui", padding: "60px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "44px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg,#6D3BF5,#0EA5A0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 800, color: "white" }}>OP</div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "#E8E8FF" }}>Onchain Pulse</div>
          </div>
          <div style={{ fontSize: "18px", color: "#A0A0B8", fontFamily: "monospace" }}>{short(address)}</div>
        </div>

        {/* Big value */}
        <div style={{ fontSize: "14px", color: "#5A5A74", letterSpacing: "1.5px", marginBottom: "10px" }}>PORTFOLIO VALUE</div>
        <div style={{ fontSize: "68px", fontWeight: 700, color: "#E8E8FF", lineHeight: 1, marginBottom: "16px" }}>{hasStats ? fmtUsd(stats.value) : "View Portfolio"}</div>

        {/* Stats row */}
        {hasStats && (
          <div style={{ display: "flex", gap: "32px", marginBottom: "auto" }}>
            {stats.dailyYield > 0 && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: "12px", color: "#5A5A74", marginBottom: "4px" }}>DAILY YIELD</div>
                <div style={{ fontSize: "24px", fontWeight: 600, color: "#14B8A6" }}>+{fmtUsd(stats.dailyYield)}</div>
              </div>
            )}
            {stats.positions > 0 && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: "12px", color: "#5A5A74", marginBottom: "4px" }}>POSITIONS</div>
                <div style={{ fontSize: "24px", fontWeight: 600, color: "#A78BFA" }}>{stats.positions}</div>
              </div>
            )}
            {stats.protocols > 0 && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: "12px", color: "#5A5A74", marginBottom: "4px" }}>PROTOCOLS</div>
                <div style={{ fontSize: "24px", fontWeight: 600, color: "#A78BFA" }}>{stats.protocols}</div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: hasStats ? "0" : "auto" }}>
          <div style={{ display: "flex", gap: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "4px", background: "#6D28D9" }} />
              <span style={{ fontSize: "14px", color: "#5A5A74" }}>Staking</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "4px", background: "#14B8A6" }} />
              <span style={{ fontSize: "14px", color: "#5A5A74" }}>Lending</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "4px", background: "#FF007A" }} />
              <span style={{ fontSize: "14px", color: "#5A5A74" }}>LP</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "4px", background: "#F59E0B" }} />
              <span style={{ fontSize: "14px", color: "#5A5A74" }}>Vaults</span>
            </div>
          </div>
          <div style={{ fontSize: "16px", color: "#3A3A54" }}>onchain-pulse.vercel.app</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
