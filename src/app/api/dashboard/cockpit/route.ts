import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { cache, userCacheKey, CACHE_TTL } from "@/lib/cache";
import { createClient } from "@/lib/supabase/server";
import { computeRoundMetrics } from "@/lib/services/pipeline/metrics";
import type { PipelineStageId } from "@/lib/services/pipeline/stages";

// =============================================
// Dashboard Cockpit API Route (Supabase)
// =============================================

/**
 * Cockpit data is per-user. A new user sees empty stats until they have data
 * of their own — never the platform-wide investor DB totals.
 *
 * Every number below is derived from rows the signed-in user owns. Anything
 * that cannot be computed from available data is reported as `null` (unknown)
 * with the reason, never as a plausible-looking 0.
 */
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const key = userCacheKey(user.id, "cockpit");
    const cached = await cache.getOrSet(key, () => computeCockpit(user.id), {
      ttlMs: CACHE_TTL.cockpit,
    });
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    console.error("Cockpit API error:", err);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");
}

/**
 * Per-user cockpit. Uses the SSR client so RLS applies to every row read.
 */
async function computeCockpit(userId: string) {
  const sp = await createClient();

  // ── Company profile ──
  const { data: profile } = await sp
    .from("company_profiles")
    .select(
      "company_name, industry, company_stage, location, one_liner, currently_raising, funding_amount, round_type, mrr, customer_count, has_pitch_deck, readiness_score, target_valuation, target_cheque_min, target_cheque_max"
    )
    .eq("user_id", userId)
    .maybeSingle();

  const companyProfile = profile
    ? {
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
      }
    : null;

  // ── The user's saved investors, with the columns the stats need ──
  // One fetch, then every derived stat is computed in memory.
  const { data: savedRows } = await sp
    .from("saved_investors")
    .select("investor_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const saved = (savedRows ?? []).filter((r) => !!r.investor_id);

  let savedInvestorDetails: Array<{
    investor_id: string;
    saved_at: string;
    full_name: string;
    investor_type: string;
    current_firm_id: string | null;
    fit_score: number | null;
    outreach_readiness: string | null;
    investment_sectors: string[] | null;
    created_at: string;
  }> = [];

  if (saved.length > 0) {
    const ids = saved.map((r) => r.investor_id);
    const { data: investors } = await sp
      .from("investors")
      .select(
        "id, full_name, investor_type, current_firm_id, fit_score, outreach_readiness, investment_sectors, created_at"
      )
      .in("id", ids);

    const byId = new Map((investors ?? []).map((inv) => [inv.id, inv]));
    savedInvestorDetails = saved
      .filter((r) => byId.has(r.investor_id))
      .map((r) => {
        const inv = byId.get(r.investor_id)!;
        return {
          investor_id: r.investor_id,
          saved_at: r.created_at,
          full_name: inv.full_name,
          investor_type: inv.investor_type,
          current_firm_id: inv.current_firm_id,
          fit_score: inv.fit_score,
          outreach_readiness: inv.outreach_readiness,
          investment_sectors: inv.investment_sectors,
          created_at: inv.created_at,
        };
      });
  }

  const scored = savedInvestorDetails.filter((i) => typeof i.fit_score === "number" && i.fit_score > 0);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const investorsThisWeek = savedInvestorDetails.filter(
    (i) => new Date(i.saved_at).getTime() >= weekAgo
  ).length;

  const highFitInvestors = savedInvestorDetails.filter(
    (i) => (i.fit_score ?? 0) >= 80
  ).length;

  const readyInvestors = savedInvestorDetails.filter(
    (i) => i.outreach_readiness === "ready"
  ).length;

  const avgFitScore =
    scored.length > 0
      ? Math.round(scored.reduce((sum, i) => sum + (i.fit_score ?? 0), 0) / scored.length)
      : null; // null = nothing scored yet, not "average of zero"

  const totalFirms = new Set(
    savedInvestorDetails.map((i) => i.current_firm_id).filter(Boolean)
  ).size;

  // Top sectors across the user's saved investors.
  const sectorCounts = new Map<string, number>();
  for (const inv of savedInvestorDetails) {
    for (const sector of inv.investment_sectors ?? []) {
      if (!sector) continue;
      sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
    }
  }
  const topSectors = [...sectorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([sector, count]) => ({ sector, count }));

  // ── Email outreach, scoped to the user's own messages ──
  let emailsSent = 0;
  let emailsReplied = 0;
  let outreachAvailable = true;
  {
    const [sentR, replyR] = await Promise.all([
      sp
        .from("email_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("direction", "outbound")
        .eq("status", "sent"),
      sp
        .from("email_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("direction", "inbound"),
    ]);
    if (isMissingTable(sentR.error) || isMissingTable(replyR.error)) {
      outreachAvailable = false;
    } else {
      emailsSent = sentR.count ?? 0;
      emailsReplied = replyR.count ?? 0;
    }
  }

  // ── Meetings, scoped to the user ──
  let meetingsScheduled: number | null = 0;
  let meetingsAvailable = true;
  {
    const { count, error } = await sp
      .from("meetings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "scheduled");
    if (isMissingTable(error)) {
      meetingsAvailable = false;
      meetingsScheduled = null; // unknown, not zero
    } else {
      meetingsScheduled = count ?? 0;
    }
  }

  // ── Pipeline stage counts (the user's own entries) ──
  let pipeline: Array<{ stage: string; count: number }> = [];
  let pipelineAvailable = true;
  let pipelineRows: Array<{
    investor_id: string;
    stage: string | null;
    expected_amount: number | string | null;
    probability: number | null;
    lost_reason: string | null;
    stage_entered_at: string | null;
    created_at: string;
  }> = [];
  {
    const { data, error } = await sp
      .from("user_pipeline_entries")
      .select("investor_id, stage, expected_amount, probability, lost_reason, stage_entered_at, created_at")
      .eq("user_id", userId);
    if (isMissingTable(error)) {
      pipelineAvailable = false;
    } else {
      pipelineRows = (data ?? []) as unknown as typeof pipelineRows;
      const counts = new Map<string, number>();
      for (const row of pipelineRows) {
        const stage = row.stage ?? "discovered";
        counts.set(stage, (counts.get(stage) ?? 0) + 1);
      }
      pipeline = [...counts.entries()].map(([stage, count]) => ({ stage, count }));
    }
  }

  // ── Active background jobs created by this user ──
  let activeCampaigns = 0;
  {
    const { count, error } = await sp
      .from("data_acquisition_jobs")
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId)
      .eq("status", "running");
    if (!isMissingTable(error)) activeCampaigns = count ?? 0;
  }

  // ── Credits consumed by this user ──
  let totalCreditsUsed: number | null = null;
  {
    const { data, error } = await sp
      .from("credit_ledger")
      .select("amount")
      .eq("user_id", userId)
      .lt("amount", 0);
    if (!isMissingTable(error) && data) {
      totalCreditsUsed = Math.abs(
        data.reduce((sum, r) => sum + Number((r as { amount: number | null }).amount ?? 0), 0)
      );
    }
  }

  // ── Round money: one definition, shared with the pipeline page ──
  const { data: eventRows } = await sp
    .from("pipeline_events")
    .select("investor_id, to_stage, created_at")
    .eq("user_id", userId);

  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  const round = computeRoundMetrics({
    targets: {
      targetAmount: num(profile?.funding_amount),
      targetValuation: num(profile?.target_valuation),
      instrument: (profile?.round_type as string | null) ?? null,
      chequeMin: num(profile?.target_cheque_min),
      chequeMax: num(profile?.target_cheque_max),
    },
    entries: pipelineRows.map((e) => ({
      id: e.investor_id,
      investorId: e.investor_id,
      stage: (e.stage ?? "discovered") as PipelineStageId,
      expectedAmount: num(e.expected_amount),
      probability: num(e.probability),
      lostReason: e.lost_reason,
      stageEnteredAt: e.stage_entered_at,
      createdAt: e.created_at,
    })),
    events: (eventRows ?? []).map((e) => ({
      investorId: e.investor_id as string,
      toStage: e.to_stage as string | null,
      createdAt: e.created_at as string,
    })),
  });

  // ── Next actions ──
  // Deterministic rules over real state. Each action names the evidence that
  // triggered it, so nothing here is a generic explore suggestion.
  const nextActions: Array<{ id: string; label: string; reason: string; href: string }> = [];
  const pipelineCount = pipelineRows.length;

  const profileGaps: string[] = [];
  if (!profile?.industry) profileGaps.push("industry");
  if (!profile?.company_stage) profileGaps.push("company stage");
  if (!profile?.location) profileGaps.push("location");
  if (profileGaps.length > 0) {
    nextActions.push({
      id: "profile",
      label: "Complete your company profile",
      reason: "Missing " + profileGaps.join(", ") + " — matching and readiness read these fields.",
      href: "/dashboard/startup",
    });
  }
  if (round.targets.targetAmount === null) {
    nextActions.push({
      id: "target",
      label: "Set your round target",
      reason: "Without a target, the pipeline cannot report progress as a percentage.",
      href: "/dashboard/pipeline",
    });
  }
  if (pipelineCount === 0) {
    nextActions.push({
      id: "add",
      label: "Add investors to your pipeline",
      reason: "Your pipeline is empty, so there is nothing to advance or project.",
      href: "/dashboard/investors/matches",
    });
  } else if (round.withAmount === 0) {
    nextActions.push({
      id: "cheques",
      label: "Set expected cheques",
      reason: pipelineCount + " investor" + (pipelineCount === 1 ? "" : "s") + " tracked, but no expected cheque, so projections read $0.",
      href: "/dashboard/pipeline",
    });
  }
  if ((profile?.readiness_score ?? 0) < 60) {
    nextActions.push({
      id: "readiness",
      label: "Close your readiness gaps",
      reason: "Readiness is " + (profile?.readiness_score ?? 0) + "/100; investors ask these questions early.",
      href: "/dashboard/readiness",
    });
  }
  if (emailsSent === 0 && pipelineCount > 0) {
    nextActions.push({
      id: "outreach",
      label: "Draft your first outreach message",
      reason: "Nothing has been sent yet — no investor knows about this round.",
      href: "/dashboard/outreach",
    });
  }

  const recentInvestors = savedInvestorDetails.slice(0, 5).map((i) => ({
    id: i.investor_id,
    full_name: i.full_name,
    investor_type: i.investor_type,
    current_firm_id: i.current_firm_id,
    firm_name: null as string | null,
    fit_score: i.fit_score,
    outreach_readiness: i.outreach_readiness,
    created_at: i.created_at,
  }));

  return {
    stats: {
      // "Saved investors" — the only investor number the user owns.
      totalInvestors: savedInvestorDetails.length,
      totalFirms,
      activeCampaigns,
      emailsSent,
      emailsReplied,
      meetingsScheduled,
      highFitInvestors,
      investorsThisWeek,
      readyInvestors,
      avgFitScore,
      totalCreditsUsed,
    },
    // Feature availability, so the UI can label an unknown rather than print 0.
    availability: {
      outreach: outreachAvailable,
      meetings: meetingsAvailable,
      pipeline: pipelineAvailable,
    },
    recentInvestors,
    pipeline,
    pipelineInvestors: pipelineCount,
    round,
    nextActions: nextActions.slice(0, 3),
    topSectors,
    companyProfile,
  };
}
