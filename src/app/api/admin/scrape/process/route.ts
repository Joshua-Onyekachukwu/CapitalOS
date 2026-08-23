import { NextRequest, NextResponse } from "next/server";
import { processRawRecords, promoteNewRecords } from "@/lib/services/investor/ingestion";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
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
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
