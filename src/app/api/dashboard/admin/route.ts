// =============================================
// Admin Dashboard API Route (Supabase)
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

    // ── Data health from Supabase investors table ──
    const [
      totalResult,
      withEmailResult,
      withLinkedinResult,
      verifiedResult,
      highQualityResult,
      highFitResult,
    ] = await Promise.all([
      sp.from("investors").select("id", { count: "exact", head: true }).eq("is_active", true),
      sp.from("investors").select("id", { count: "exact", head: true }).eq("is_active", true).not("email", "is", null),
      sp.from("investors").select("id", { count: "exact", head: true }).eq("is_active", true).not("linkedin_url", "is", null),
      sp.from("investors").select("id", { count: "exact", head: true }).eq("is_active", true).eq("is_verified", true),
      sp.from("investors").select("id", { count: "exact", head: true }).eq("is_active", true).gte("data_quality_score", 80),
      sp.from("investors").select("id", { count: "exact", head: true }).eq("is_active", true).gte("fit_score", 80),
    ]);

    // ── CockroachDB-only tables — gracefully return empty ──
    let pendingDuplicates = 0;
    let autoResolvedDuplicates = 0;
    let approvedDuplicates = 0;
    let rejectedDuplicates = 0;
    let recentJobs: any[] = [];
    let rawRecords: any[] = [];
    let dataSources: any[] = [];
    let pendingDuplicatesList: any[] = [];
    let recentChanges: any[] = [];
    let recentAudit: any[] = [];
    let pendingRawRecords = 0;

    // Try each table — gracefully handle if it doesn't exist in Supabase
    try {
      const { count } = await sp.from("duplicate_candidates").select("id", { count: "exact", head: true }).eq("status", "pending");
      pendingDuplicates = count || 0;
    } catch { /* table may not exist */ }

    try {
      const { count } = await sp.from("duplicate_candidates").select("id", { count: "exact", head: true }).eq("status", "auto_resolved");
      autoResolvedDuplicates = count || 0;
    } catch { /* table may not exist */ }

    try {
      const { count } = await sp.from("duplicate_candidates").select("id", { count: "exact", head: true }).eq("status", "approved");
      approvedDuplicates = count || 0;
    } catch { /* table may not exist */ }

    try {
      const { count } = await sp.from("duplicate_candidates").select("id", { count: "exact", head: true }).eq("status", "rejected");
      rejectedDuplicates = count || 0;
    } catch { /* table may not exist */ }

    try {
      const { data } = await sp.from("data_acquisition_jobs").select("*").order("created_at", { ascending: false }).limit(20);
      recentJobs = data || [];
    } catch { /* table may not exist */ }

    try {
      const { data } = await sp.from("raw_records").select("id, status, source_provider, created_at");
      rawRecords = data || [];
    } catch { /* table may not exist */ }

    try {
      const { data } = await sp.from("investor_data_sources").select("field_name, source_type, source_provider, created_at").order("created_at", { ascending: false }).limit(1000);
      dataSources = data || [];
    } catch { /* table may not exist */ }

    try {
      const { data } = await sp.from("data_change_log").select("*").order("created_at", { ascending: false }).limit(20);
      recentChanges = data || [];
    } catch { /* table may not exist */ }

    try {
      const { data } = await sp.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(20);
      recentAudit = data || [];
    } catch { /* table may not exist */ }

    try {
      const { count } = await sp.from("raw_records").select("id", { count: "exact", head: true }).eq("status", "pending");
      pendingRawRecords = count || 0;
    } catch { /* table may not exist */ }

    return NextResponse.json({
      dataHealth: {
        total_investors: totalResult.count || 0,
        with_email: withEmailResult.count || 0,
        with_linkedin: withLinkedinResult.count || 0,
        verified: verifiedResult.count || 0,
        high_quality: highQualityResult.count || 0,
        high_fit: highFitResult.count || 0,
        pending_duplicates: pendingDuplicates,
        pending_raw_records: pendingRawRecords,
      },
      duplicateStats: {
        pending: pendingDuplicates,
        autoResolved: autoResolvedDuplicates,
        approved: approvedDuplicates,
        rejected: rejectedDuplicates,
      },
      recentJobs,
      rawRecords,
      dataSources,
      pendingDuplicatesList,
      recentChanges,
      recentAudit,
      pendingRawRecords,
    });
  } catch (err) {
    console.error("Admin dashboard error:", err);
    return NextResponse.json(
      { error: "Failed to load admin data" },
      { status: 500 }
    );
  }
}
