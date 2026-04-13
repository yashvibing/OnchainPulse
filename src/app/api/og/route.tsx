import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "edge";

function short(a: string) {
  return a.slice(0, 6) + "..." + a.slice(-4);
}

const BG = "linear-gradient(135deg, #0D0B1A 0%, #1a1535 50%, #0D0B1A 100%)";
const LOGO_BG = "linear-gradient(135deg, #6D3BF5, #0EA5A0)";

export function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const hasAddress = address && /^0x[a-fA-F0-9]{40}$/.test(address);

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BG, fontFamily: "system-ui", padding: "60px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "48px" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: LOGO_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 800, color: "white" }}>OP</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "36px", fontWeight: 700, color: "#E8E8FF" }}>Onchain Pulse</div>
          <div style={{ fontSize: "16px", color: "#5A5A74" }}>Monad Portfolio Tracker</div>
        </div>
      </div>

      {/* Content */}
      {hasAddress ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: "14px", color: "#5A5A74", letterSpacing: "1px", marginBottom: "12px" }}>PORTFOLIO FOR</div>
          <div style={{ fontSize: "32px", fontWeight: 600, color: "#A78BFA", fontFamily: "monospace", marginBottom: "32px" }}>{short(address)}</div>
          <div style={{ fontSize: "20px", color: "#A0A0B8", lineHeight: 1.6 }}>
            View staking, lending, LP positions, yield vaults, and token holdings on the Monad ecosystem.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: "24px", color: "#A0A0B8", maxWidth: "600px", lineHeight: 1.6 }}>
            Track your DeFi positions across the Monad ecosystem. Staking, lending, LP, vaults, and tokens — all in one view.
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", gap: "24px" }}>
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
    </div>,
    { width: 1200, height: 630 }
  );
}
