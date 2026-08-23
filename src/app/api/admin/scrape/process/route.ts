import { NextRequest, NextResponse } from "next/server";
import { processRawRecords, promoteNewRecords } from "@/lib/services/investor/ingestion";
import { requireAuth } from "@/lib/middleware/api-auth";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;
  try {
    // Step 1: Process pending raw records (normalize + match)
    const processResult = await processRawRecords(500);

    // Step 2: Promote new records to canonical investors
    const promoteResult = await promoteNewRecords(processResult.newRecords);

    return NextResponse.json({
      ...processResult,
      promoted: promoteResult.promoted,
      promoteErrors: promoteResult.errors,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pipeline failed" },
      { status: 500 }
    );
  }
}
