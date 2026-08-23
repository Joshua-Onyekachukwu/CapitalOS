// API Route: Scheduled Deduplication
import { NextRequest, NextResponse } from "next/server";
import { runScheduledDedup } from "@/lib/services/investor/scheduled-dedup";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { limit, batchSize } = body;

    const result = await runScheduledDedup(limit || 500, batchSize || 50);

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
