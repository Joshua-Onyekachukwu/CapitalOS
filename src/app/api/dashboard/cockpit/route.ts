import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { cache, userCacheKey, CACHE_TTL } from "@/lib/cache";
import { createClient } from "@supabase/supabase-js";

// =============================================
// Dashboard Cockpit API Route (Supabase)
// =============================================

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
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

async function computeCockpit() {
  const sp = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Run all queries in parallel
  const [
    totalResult,
    highFitResult,
    readyResult,
    avgResult,
    pipelineResult,
    recentResult,
    thisWeekResult,
    emailResult,
  ] = await Promise.all([
    sp.from("investors").select("id", { count: "exact", head: true }),
    sp.from("investors").select("id", { count: "exact", head: true }).gte("fit_score", 80),
    sp.from("investors").select("id", { count: "exact", head: true }).eq("outreach_readiness", "ready"),
    sp.from("investors").select("fit_score").gt("fit_score", 0).limit(1000),
    (async () => {
        const stages = ["ready", "needs_verification", "not_ready", "contacted", "do_not_contact", "low_priority"];
        const stageResults = await Promise.all(
          stages.map(stage =>
            sp.from("investors").select("id", { count: "exact", head: true }).eq("outreach_readiness", stage)
          )
        );
        return stages.map((stage, i) => ({ stage, count: stageResults[i].count || 0 })).filter(r => r.count > 0);
      })(),
    sp.from("investors").select("id, full_name, investor_type, fit_score, outreach_readiness, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    sp.from("investors").select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    // Email stats from outreach_emails if table exists
    Promise.resolve({ count: 0 }).catch(() => ({ count: 0 })),
  ]);

  const totalInvestors = totalResult.count || 0;
  const highFitInvestors = highFitResult.count || 0;
  const readyInvestors = readyResult.count || 0;
  const thisWeekCount = thisWeekResult.count || 0;

  // Calculate average fit score from sample
  const sampleScores = (avgResult.data || []).map((r: any) => r.fit_score).filter(Boolean);
  const avgFitScore = sampleScores.length > 0
    ? Math.round(sampleScores.reduce((a: number, b: number) => a + b, 0) / sampleScores.length)
    : 0;

  // Pipeline
  const pipeline = (pipelineResult || []).map((p: any) => ({
    stage: p.stage,
    count: p.count,
  }));

  // Recent investors
  const recentInvestors = (recentResult.data || []).map((inv: any) => ({
    id: inv.id,
    full_name: inv.full_name,
    investor_type: inv.investor_type,
    current_firm_id: null,
    firm_name: null,
    fit_score: inv.fit_score,
    outreach_readiness: inv.outreach_readiness,
    created_at: inv.created_at,
  }));

  // Company profile from Supabase
  let companyProfile = null;
  try {
    const { data: { user: authUser } } = await sp.auth.getUser();
    if (authUser) {
      const { data: profile } = await sp
        .from("company_profiles")
        .select("company_name, industry, company_stage, one_liner, currently_raising, funding_amount, round_type, mrr, customer_count, has_pitch_deck, readiness_score")
        .eq("user_id", authUser.id)
        .single();
      if (profile) {
        companyProfile = {
          companyName: profile.company_name,
          industry: profile.industry,
          companyStage: profile.company_stage,
          oneLiner: profile.one_liner,
          currentlyRaising: profile.currently_raising,
          fundingAmount: profile.funding_amount,
          roundType: profile.round_type,
          mrr: profile.mrr,
          customerCount: profile.customer_count,
          hasPitchDeck: profile.has_pitch_deck,
          readinessScore: profile.readiness_score,
        };
      }
    }
  } catch {
    // Non-critical
  }

  return {
    stats: {
      totalInvestors,
      totalFirms: 0,
      activeCampaigns: 0,
      emailsSent: 0,
      emailsReplied: 0,
      meetingsScheduled: 0,
      highFitInvestors,
      investorsThisWeek: thisWeekCount,
      readyInvestors,
      avgFitScore,
      totalCreditsUsed: 0,
    },
    recentInvestors,
    pipeline,
    topSectors: [],
    companyProfile,
  };
}
