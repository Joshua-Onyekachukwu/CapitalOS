// API Route: Scheduled Deduplication
import { NextRequest, NextResponse } from "next/server";
import { runScheduledDedup } from "@/lib/services/investor/scheduled-dedup";
import { requireAuth } from "@/lib/middleware/api-auth";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { limit, batchSize } = body;

    const result = await runScheduledDedup(limit || 500, batchSize || 50);

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Dedup failed" },
      { status: 500 }
    );
  }
}
