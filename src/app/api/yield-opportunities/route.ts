import { NextResponse } from "next/server";
import { fetchCombinedYieldOpportunities } from "@/services/yields-aggregator";

export const revalidate = 300;

export async function GET() {
  try {
    const opportunities = await fetchCombinedYieldOpportunities();
    return NextResponse.json(opportunities);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch yield opportunities" },
      { status: 502 }
    );
  }
}
