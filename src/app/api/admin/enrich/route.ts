// API Route: Batch Investor Enrichment
import { NextRequest, NextResponse } from "next/server";
import { enrichBatch } from "@/lib/services/investor/enrichment";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { limit } = body;

    const result = await enrichBatch(limit || 500);

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Enrichment failed" },
      { status: 500 }
    );
  }
}
