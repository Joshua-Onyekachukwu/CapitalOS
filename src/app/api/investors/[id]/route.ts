// =============================================
// Investor Detail API Route
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    // Fetch investor
    const investors = await query<any>(
      `SELECT * FROM investors WHERE id = $1`,
      [id]
    );

    if (!investors.length) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 });
    }

    const investor = investors[0];

    // Fetch firm data if linked
    let firm = null;
    if (investor.current_firm_id) {
      const firms = await query<any>(
        `SELECT name, firm_type, fund_size FROM investor_firms WHERE id = $1`,
        [investor.current_firm_id]
      );
      firm = firms[0] || null;
    }

    // Fetch investor profile (AI research)
    const profiles = await query<any>(
      `SELECT ai_reasoning, ai_summary, recommended_angle, potential_objections
       FROM investor_profiles WHERE investor_id = $1`,
      [id]
    );

    return NextResponse.json({
      investor,
      firm,
      profile: profiles[0] || null,
    });
  } catch (err) {
    console.error("Investor detail error:", err);
    return NextResponse.json(
      { error: "Failed to load investor" },
      { status: 500 }
    );
  }
}
