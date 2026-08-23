import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware/api-auth";

export async function GET(_request: NextRequest) {
  const user = await requireAuth(_request);
  if (user instanceof NextResponse) return user;

  try {
    // Get investors in "meeting" or "interested" pipeline stage
    const data = await query<any>(
      `SELECT
         i.id,
         i.full_name,
         f.name AS firm_name,
         i.investor_type,
         i.fit_score,
         i.outreach_readiness,
         i.email
       FROM investors i
       LEFT JOIN investor_firms f ON i.current_firm_id = f.id
       WHERE i.outreach_readiness IN ('contacted', 'ready')
         AND i.is_active = true
       ORDER BY i.fit_score DESC
       LIMIT 50`
    );

    const investors = data.map((inv) => ({
      id: inv.id,
      full_name: inv.full_name,
      firm_name: inv.firm_name,
      investor_type: inv.investor_type,
      fit_score: inv.fit_score,
      outreach_readiness: inv.outreach_readiness,
      email: inv.email,
    }));

    return NextResponse.json({ investors });
  } catch (err) {
    console.error("Meetings API error:", err);
    return NextResponse.json({ error: "Failed to load meetings" }, { status: 500 });
  }
}
