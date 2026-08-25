// =============================================
// Dashboard Analytics API Route (Supabase)
// =============================================

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

    // Investors from Supabase (primary data)
    const { data: investors, error: invError } = await sp
      .from("investors")
      .select("id, email, fit_score, is_verified, investment_sectors, country, investor_type, outreach_readiness, created_at")
      .eq("is_active", true);

    if (invError) throw invError;

    // These tables may not exist in Supabase yet — gracefully return empty
    let emails: any[] = [];
    let pendingDuplicates = 0;
    let campaigns: any[] = [];

    try {
      const { data } = await sp.from("email_messages").select("id, direction, status, created_at");
      emails = data || [];
    } catch { /* table may not exist */ }

    try {
      const { count } = await sp.from("duplicate_candidates").select("id", { count: "exact", head: true }).eq("status", "pending");
      pendingDuplicates = count || 0;
    } catch { /* table may not exist */ }

    try {
      const { data } = await sp.from("data_acquisition_jobs").select("id, status").eq("job_type", "campaign");
      campaigns = data || [];
    } catch { /* table may not exist */ }

    return NextResponse.json({
      investors: investors || [],
      emails,
      pendingDuplicates,
      campaigns,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json(
      { error: "Failed to load analytics" },
      { status: 500 }
    );
  }
}
