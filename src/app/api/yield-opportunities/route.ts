import { NextResponse } from "next/server";
import { fetchCombinedYieldOpportunitiesWithMeta } from "@/services/yields-aggregator";

export const revalidate = 300;

export async function GET() {
  try {
    const result = await fetchCombinedYieldOpportunitiesWithMeta();
    return NextResponse.json(result.data, {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=1800",
        "X-Cache-Status": result.status,
        "X-Cache-Age-Ms": String(result.ageMs),
        "X-Data-Fetched-At": String(result.fetchedAt),
      },
    });
  } catch (error) {
    console.error("[yield-opportunities] failed", error);
    return NextResponse.json(
      { error: "Failed to fetch yield opportunities" },
      { status: 502 }
    );
  }
}
