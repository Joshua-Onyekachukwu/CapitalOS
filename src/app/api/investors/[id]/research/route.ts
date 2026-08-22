// =============================================
// Investor Research API Route
// =============================================
// Client components call this to generate AI research summaries.
// Server-side only — AI client is never exposed to the browser bundle.

import { NextRequest, NextResponse } from "next/server";
import { generateInvestorResearch } from "@/lib/actions/investor-research";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await generateInvestorResearch(params.id);

    if (!result) {
      return NextResponse.json(
        { error: "Could not generate research summary" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Research generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Research generation failed" },
      { status: 500 }
    );
  }
}
