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
    const [investorResult] = await Promise.all([
      // 1. Main investor record
      supabase.from("investors").select("*").eq("id", id).single(),
    ]);

    const { data: investor, error } = investorResult;

    if (error || !investor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 });
    }

    // Fetch firm data if we have a current_firm_id
    let firm = null;
    if (investor.current_firm_id) {
      const { data: firmData } = await supabase
        .from("investor_firms")
        .select("*")
        .eq("id", investor.current_firm_id)
        .single();
      firm = firmData;
    }

    // Merge auditability: if this record absorbed duplicates (keeper), return
    // the merge_history entries; if this record was merged away (loser),
    // return the keeper it points to so the UI can redirect/annotate.
    let mergeHistory: Array<Record<string, unknown>> = [];
    let mergedInto: { id: string; full_name: string } | null = null;
    if (Array.isArray(investor.merge_history) && investor.merge_history.length > 0) {
      mergeHistory = investor.merge_history;
    }
    if (investor.merged_into_id) {
      const { data: keeper } = await supabase
        .from("investors")
        .select("id, full_name")
        .eq("id", investor.merged_into_id)
        .maybeSingle();
      if (keeper) mergedInto = keeper;
    }

    // Fetch AI research profile (investor_profiles table)
    let profile = null;
    try {
      const { data: profileData } = await supabase
        .from("investor_profiles")
        .select("*")
        .eq("investor_id", id)
        .single();
      profile = profileData;
    } catch {
      // table may not have this record
    }

    // Filter similar investors by same type, excluding this one
    // (no firm_name column on investors — firm name is resolved client-side
    // from the `firm` object when current_firm_id is set)
    const { data: similarData } = await supabase
      .from("investors")
      .select("id, full_name, investor_type, fit_score, country, email")
      .eq("investor_type", investor.investor_type)
      .neq("id", id)
      .order("fit_score", { ascending: false })
      .limit(5);

    const similar = similarData || [];

    return NextResponse.json({
      investor,
      firm,
      profile,
      similar,
      mergeHistory,
      mergedInto,
    });
  } catch (err) {
    console.error("Investor detail error:", err);
    return NextResponse.json(
      { error: "Failed to load investor" },
      { status: 500 }
    );
  }
}
