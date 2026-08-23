// =============================================
// Dashboard Analytics API Route
// =============================================
// Returns aggregated analytics data from CockroachDB.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export async function GET(_request: NextRequest) {
  const user = await requireAuth(_request);
  if (user instanceof NextResponse) return user;

  try {
    const [
      investors,
      emails,
      pendingDuplicates,
      campaigns,
    ] = await Promise.all([
      query<any>(
        `SELECT id, email, fit_score, is_verified, investment_sectors, country, investor_type, outreach_readiness, created_at
         FROM investors WHERE is_active = true`
      ),
      query<any>(
        `SELECT id, direction, status, created_at FROM email_messages`
      ),
      query<{ id: string }>(
        `SELECT id FROM duplicate_candidates WHERE status = 'pending'`
      ),
      query<any>(
        `SELECT id, status FROM data_acquisition_jobs WHERE job_type = 'campaign'`
      ),
    ]);

    return NextResponse.json({
      investors,
      emails,
      pendingDuplicates: pendingDuplicates.length,
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
