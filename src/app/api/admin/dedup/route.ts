// API Route: Scheduled Deduplication
import { NextRequest, NextResponse } from "next/server";
import { runScheduledDedup } from "@/lib/services/investor/scheduled-dedup";

export async function POST(request: NextRequest) {
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
