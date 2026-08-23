import { NextRequest, NextResponse } from "next/server";
import { runEdgarPipeline } from "@/lib/services/scrapers/edgar";
import { requireAuth } from "@/lib/middleware/api-auth";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { startDate, endDate, limit } = body;

    const result = await runEdgarPipeline(
      startDate || "2024-01-01",
      endDate || "2024-12-31",
      limit || 200
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "EDGAR pipeline failed" },
      { status: 500 }
    );
  }
}
