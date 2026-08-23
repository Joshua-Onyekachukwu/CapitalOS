// =============================================
// Investor Research API Route
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { generateInvestorResearch } from "@/lib/actions/investor-research";
import { requireAuth } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;
  try {
    const { id } = await params;
    const result = await generateInvestorResearch(id);

    if (!result) {
      return NextResponse.json(
        { error: "Could not generate research. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Research error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
