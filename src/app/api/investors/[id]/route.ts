// =============================================
// Investor Detail API Route
// =============================================
// Returns enriched investor profile with firm data, fit profile, similar investors.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fire all queries in parallel for maximum speed
    const [investorResult, firmResult, profileResult, similarResult] = await Promise.all([
      // 1. Main investor record
      supabase.from("investors").select("*").eq("id", id).single(),

      // 2. We'll get firm_id from the investor first, but we can pre-fetch with a join
      supabase.from("investors").select("firm_id").eq("id", id).single(),

      // 3. Fit profile
      supabase.from("investor_fit_profiles").select("*").eq("investor_id", id).single().then(r => r).catch(() => ({ data: null })),

      // 4. Will build similar after we know the type — but we can start with a general query
      supabase.from("investors").select("id, full_name, investor_type, fit_score, firm_name, country, email").order("fit_score", { ascending: false }).limit(10),
    ]);

    const { data: investor, error } = investorResult;

    if (error || !investor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 });
    }

    // Fetch firm data if we have a firm_id
    let firm = null;
    if (investor.firm_id) {
      const { data: firmData } = await supabase
        .from("investor_firms")
        .select("*")
        .eq("id", investor.firm_id)
        .single();
      firm = firmData;
    }

    const profile = profileResult?.data || null;

    // Filter similar investors by same type, excluding this one
    const similar = (similarResult?.data || [])
      .filter((s: any) => s.id !== id && s.investor_type === investor.investor_type)
      .slice(0, 5);

    return NextResponse.json({
      investor,
      firm,
      profile,
      similar,
    });
  } catch (err) {
    console.error("Investor detail error:", err);
    return NextResponse.json(
      { error: "Failed to load investor" },
      { status: 500 }
    );
  }
}
