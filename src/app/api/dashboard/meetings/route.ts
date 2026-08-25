import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

export async function GET(_request: NextRequest) {
  const user = await requireAuth(_request);
  if (user instanceof NextResponse) return user;

  try {
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get investors in "meeting" or "interested" pipeline stage
    const { data, error } = await sp
      .from("investors")
      .select("id, full_name, investor_type, fit_score, outreach_readiness, email, current_firm_id, company_name")
      .in("outreach_readiness", ["contacted", "ready"])
      .eq("is_active", true)
      .order("fit_score", { ascending: false })
      .limit(50);

    if (error) throw error;

    const investors = (data || []).map((inv) => ({
      id: inv.id,
      full_name: inv.full_name,
      firm_name: inv.company_name || null,
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
