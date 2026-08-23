// =============================================
// Email Sequence API Route
// =============================================
// Generates a 3-step email sequence for investor outreach.
// Server-side only — AI client never exposed to browser bundle.

import { NextRequest, NextResponse } from "next/server";
import { generateEmailSequence } from "@/lib/actions/email-sequences";
import { requireAuth } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export async function POST(request: NextRequest) {
  const authUser = await requireAuth(request);
  if (authUser instanceof NextResponse) return authUser;

  try {
    const body = await request.json();
    const { investorId, founderName, companyName, companyDescription, roundType, raiseAmount, tone } = body;

    if (!investorId || !founderName || !companyName) {
      return NextResponse.json(
        { error: "investorId, founderName, and companyName are required" },
        { status: 400 }
      );
    }

    const result = await generateEmailSequence({
      investorId,
      startupName: companyName,
      startupDescription: companyDescription || "",
      startupStage: roundType || "Seed",
      founderName,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Could not generate email sequence" },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Email sequence error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
