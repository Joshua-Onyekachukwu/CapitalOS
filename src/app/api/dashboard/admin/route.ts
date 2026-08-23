// =============================================
// Admin Dashboard API Route
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware/api-auth";

export async function GET(_request: NextRequest) {
  const user = await requireAuth(_request);
  if (user instanceof NextResponse) return user;

  try {
    const [
      totalInvestors,
      withEmail,
      withLinkedin,
      verified,
      highQuality,
      highFit,
      pendingDuplicates,
      autoResolvedDuplicates,
      approvedDuplicates,
      rejectedDuplicates,
      recentJobs,
      rawRecords,
      dataSources,
      pendingDuplicatesList,
      recentChanges,
      recentAudit,
      pendingRawRecords,
    ] = await Promise.all([
      // Data health
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM investors WHERE is_active = true`),
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM investors WHERE is_active = true AND email IS NOT NULL`),
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM investors WHERE is_active = true AND linkedin_url IS NOT NULL`),
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM investors WHERE is_active = true AND is_verified = true`),
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM investors WHERE is_active = true AND data_quality_score >= 80`),
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM investors WHERE is_active = true AND fit_score >= 80`),
      // Duplicate stats
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM duplicate_candidates WHERE status = 'pending'`),
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM duplicate_candidates WHERE status = 'auto_resolved'`),
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM duplicate_candidates WHERE status = 'approved'`),
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM duplicate_candidates WHERE status = 'rejected'`),
      // Recent jobs
      query<any>(`SELECT * FROM data_acquisition_jobs ORDER BY created_at DESC LIMIT 20`),
      // Raw records
      query<any>(`SELECT id, status, source_provider, created_at FROM raw_records`),
      // Data sources
      query<any>(`SELECT field_name, source_type, source_provider, created_at FROM investor_data_sources ORDER BY created_at DESC LIMIT 1000`),
      // Pending duplicates
      query<any>(
        `SELECT dc.id, dc.confidence, dc.match_signals, dc.status, dc.created_at,
                ia.full_name AS investor_a_name, ib.full_name AS investor_b_name
         FROM duplicate_candidates dc
         JOIN investors ia ON dc.investor_a_id = ia.id
         JOIN investors ib ON dc.investor_b_id = ib.id
         WHERE dc.status = 'pending'
         ORDER BY dc.confidence DESC
         LIMIT 10`
      ),
      // Recent changes
      query<any>(`SELECT * FROM data_change_log ORDER BY created_at DESC LIMIT 20`),
      // Recent audit
      query<any>(`SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 20`),
      // Pending raw records count
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM raw_records WHERE status = 'pending'`),
    ]);

    return NextResponse.json({
      dataHealth: {
        total_investors: parseInt(totalInvestors[0]?.count || "0"),
        with_email: parseInt(withEmail[0]?.count || "0"),
        with_linkedin: parseInt(withLinkedin[0]?.count || "0"),
        verified: parseInt(verified[0]?.count || "0"),
        high_quality: parseInt(highQuality[0]?.count || "0"),
        high_fit: parseInt(highFit[0]?.count || "0"),
        pending_duplicates: parseInt(pendingDuplicates[0]?.count || "0"),
        pending_raw_records: parseInt(pendingRawRecords[0]?.count || "0"),
      },
      duplicateStats: {
        pending: parseInt(pendingDuplicates[0]?.count || "0"),
        autoResolved: parseInt(autoResolvedDuplicates[0]?.count || "0"),
        approved: parseInt(approvedDuplicates[0]?.count || "0"),
        rejected: parseInt(rejectedDuplicates[0]?.count || "0"),
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
