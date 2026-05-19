import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { withServerCache } from "@/lib/serverCache";
import { isValidEvmAddress } from "@/lib/format";
import { serializeTokenBalances } from "@/services/portfolio";
import { fetchTokenBalances } from "@/services/tokens";

export const dynamic = "force-dynamic";

const TOKEN_BALANCE_TTL_MS = 60_000;
const TOKEN_BALANCE_STALE_TTL_MS = 10 * 60_000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  if (!isValidEvmAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const normalized = getAddress(address);

  try {
    const result = await withServerCache(
      `token-balances:${normalized.toLowerCase()}`,
      TOKEN_BALANCE_TTL_MS,
      async () => serializeTokenBalances(await fetchTokenBalances(normalized as `0x${string}`)),
      TOKEN_BALANCE_STALE_TTL_MS
    );

    return NextResponse.json(
      {
        data: result.data,
        meta: {
          cacheStatus: result.status,
          cacheAgeMs: result.ageMs,
          fetchedAt: result.fetchedAt,
          durationMs: result.durationMs,
        },
      },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=600",
          "X-Cache-Status": result.status,
          "X-Cache-Age-Ms": String(result.ageMs),
        },
      }
    );
  } catch (error) {
    console.error("[token-balances] failed", error);
    return NextResponse.json(
      { error: "Failed to load token balances" },
      { status: 502 }
    );
  }
}
