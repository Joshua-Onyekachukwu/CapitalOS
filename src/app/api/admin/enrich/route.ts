// API Route: Batch Investor Enrichment
import { NextRequest, NextResponse } from "next/server";
import { enrichBatch } from "@/lib/services/investor/enrichment";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { limit } = body;

    const result = await enrichBatch(limit || 500);

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
