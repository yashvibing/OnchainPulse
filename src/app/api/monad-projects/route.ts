import { NextResponse } from "next/server";
import { fetchMonadProjects } from "@/services/projects";

export const revalidate = 300;

export async function GET() {
  try {
    const data = await fetchMonadProjects();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch Monad projects" },
      { status: 502 }
    );
  }
}
