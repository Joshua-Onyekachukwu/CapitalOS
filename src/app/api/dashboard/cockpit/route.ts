import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { cache, userCacheKey, CACHE_TTL } from "@/lib/cache";

// =============================================
// Dashboard Cockpit API Route
// =============================================
// Returns all data needed for the main dashboard page:
//   - Stats (investors, campaigns, emails, credits)
//   - Recent investors (with firm names)
//   - Pipeline summary (outreach readiness distribution)
//   - Company profile
// =============================================

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    // ── Check cache first (user-scoped, 30s TTL) ──
    const key = userCacheKey(user.id, "cockpit");
    const cached = await cache.getOrSet(
      key,
      () => computeCockpit(),
      { ttlMs: CACHE_TTL.cockpit }
    );
    return NextResponse.json(cached);
  } catch (err) {
    console.error("Cockpit API error:", err);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}

// ── Separated computation function (cached) ──
async function computeCockpit() {
    const [
      investorStats,
      firmStats,
      campaignStats,
      emailStats,
      creditStats,
      recentInvestors,
      pipelineData,
      sectorData,
      thisWeekCount,
    ] = await Promise.all([
      // Total investors + fit stats
      query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM investors WHERE is_active = true`
      ),

      // Total firms
      query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM investor_firms`
      ),

      // Campaign stats (data_acquisition_jobs)
      query<{ status: string; count: number; found_count: number }>(
        `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(found_count), 0)::int AS found_count
         FROM data_acquisition_jobs
         WHERE created_by IS NOT NULL
         GROUP BY status`
      ),

      // Email stats
      query<{ direction: string; status: string; count: number }>(
        `SELECT direction, status, COUNT(*)::int AS count
         FROM email_messages
         GROUP BY direction, status`
      ),

      // Credit usage
      query<{ total: number }>(
        `SELECT COALESCE(SUM(ABS(amount)), 0)::int AS total FROM credit_ledger`
      ),

      // Recent investors (with firm name via JOIN)
      query<any>(
        `SELECT i.id, i.full_name, i.investor_type, i.current_firm_id,
                f.name AS firm_name, i.fit_score, i.outreach_readiness, i.created_at
         FROM investors i
         LEFT JOIN investor_firms f ON i.current_firm_id = f.id
         WHERE i.is_active = true
         ORDER BY i.created_at DESC
         LIMIT 5`
      ),

      // Pipeline summary (outreach readiness distribution)
      query<{ outreach_readiness: string; count: number }>(
        `SELECT outreach_readiness, COUNT(*)::int AS count
         FROM investors
         WHERE is_active = true
         GROUP BY outreach_readiness
         ORDER BY count DESC`
      ),

      // Top sectors (for optional chart)
      query<{ sector: string; count: number }>(
        `SELECT s AS sector, COUNT(*)::int AS count
         FROM investors, unnest(investment_sectors) AS s
         WHERE is_active = true
         GROUP BY s
         ORDER BY count DESC
         LIMIT 10`
      ),

      // Investors added this week
      query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM investors
         WHERE is_active = true AND created_at >= NOW() - INTERVAL '7 days'`
      ),
    ]);

    // ── Compute stats ──
    const totalInvestors = investorStats[0]?.count || 0;
    const totalFirms = firmStats[0]?.count || 0;
    const investorsThisWeek = thisWeekCount[0]?.count || 0;

    // Campaign stats
    const activeCampaigns = campaignStats
      .filter((c) => c.status === "running" || c.status === "pending")
      .reduce((sum, c) => sum + c.count, 0);

    // Email stats
    const emailsSent = emailStats
      .filter((e) => e.direction === "outbound" && e.status === "sent")
      .reduce((sum, e) => sum + e.count, 0);
    const emailsReplied = emailStats
      .filter((e) => e.direction === "inbound")
      .reduce((sum, e) => sum + e.count, 0);

    // Credits
    const totalCreditsUsed = creditStats[0]?.total || 0;

    // High-fit investors (fit_score >= 80)
    const highFitResult = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM investors WHERE is_active = true AND fit_score >= 80`
    );
    const highFitInvestors = highFitResult[0]?.count || 0;

    // Ready for outreach
    const readyResult = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM investors WHERE is_active = true AND outreach_readiness = 'ready'`
    );
    const readyInvestors = readyResult[0]?.count || 0;

    // Average fit score (sample for performance)
    const avgResult = await query<{ avg: number }>(
      `SELECT ROUND(AVG(fit_score))::int AS avg FROM investors WHERE is_active = true AND fit_score > 0`
    );
    const avgFitScore = avgResult[0]?.avg || 0;

    // Pipeline
    const pipeline = pipelineData.map((row) => ({
      stage: row.outreach_readiness || "not_ready",
      count: row.count,
    }));

    return {
      stats: {
        totalInvestors,
        totalFirms,
        activeCampaigns,
        emailsSent,
        emailsReplied,
        meetingsScheduled: 0,
        highFitInvestors,
        investorsThisWeek,
        readyInvestors,
        avgFitScore,
        totalCreditsUsed,
      },
      recentInvestors: recentInvestors.map((inv) => ({
        id: inv.id,
        full_name: inv.full_name,
        investor_type: inv.investor_type,
        current_firm_id: inv.current_firm_id,
        firm_name: inv.firm_name,
        fit_score: inv.fit_score,
        outreach_readiness: inv.outreach_readiness,
        created_at: inv.created_at,
      })),
      pipeline,
      topSectors: sectorData.map((s) => ({
        sector: s.sector,
        count: s.count,
      })),
    };
}
