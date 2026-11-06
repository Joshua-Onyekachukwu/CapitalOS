// =============================================
// Fundraising Pipeline API — per-user (Phase 2)
// =============================================
// Pipeline state lives in `user_pipeline_entries` (per founder) with an
// audit trail in `pipeline_events`. Stage counts and stage listings are this
// founder's entries ONLY — the shared `outreach_readiness` column is a batch
// qualification of the whole corpus and is returned separately as `dataset`,
// labelled with its source. The shared investors table is never written by
// this API.
//
// GET  /api/investors/pipeline          → stage summary (+ investors when ?stage=)
// POST /api/investors/pipeline          → move investor to a new stage

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";
import {
  PIPELINE_STAGES,
  READINESS_TO_STAGE,
  isPipelineStageId,
  type PipelineStageId,
} from "@/lib/services/pipeline/stages";
import {
  computeRoundMetrics,
  type PipelineEntry as RoundEntry,
  type PipelineMoveEvent,
} from "@/lib/services/pipeline/metrics";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const INVESTOR_FIELDS =
  "id, full_name, investor_type, fit_score, outreach_readiness, country, city, email, linkedin_url, investment_stages, investment_sectors, created_at";

type EntryRow = {
  id: string;
  stage: PipelineStageId;
  created_at: string;
  expected_amount: number | string | null;
  probability: number | null;
  investor: {
    id: string;
    full_name: string;
    investor_type: string;
    fit_score: number;
    outreach_readiness: string;
    country: string | null;
    city: string | null;
    email: string | null;
    linkedin_url: string | null;
    investment_stages: string[] | null;
    investment_sectors: string[] | null;
    created_at: string;
    investor_firms: { name: string } | { name: string }[] | null;
  } | null;
};

function flattenFirmName(inv: { investor_firms?: { name: string } | { name: string }[] | null }): string | null {
  const f = inv.investor_firms;
  if (!f) return null;
  return Array.isArray(f) ? f[0]?.name ?? null : f.name;
}

function toUiInvestor(inv: Record<string, any>, stage: PipelineStageId) {
  return {
    ...inv,
    // Task 2.5: the shared batch-qualification status is renamed
    // `dataset_status` so it can't be confused with the investor's personal
    // `pipeline_stage` (owned by user_pipeline_entries per founder; the
    // shared investors table is never written by this API).
    dataset_status: inv.outreach_readiness,
    outreach_readiness: undefined,
    pipeline_stage: stage,
  };
}

// Readiness values that can appear on the investors table (DB enum)
const DB_READINESS_VALUES = ["not_ready", "needs_verification", "ready", "contacted", "do_not_contact"];

// ── GET: stage summary + optional investors for one stage ──
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const sp = getSp();
  const url = request.nextUrl;
  const stage = url.searchParams.get("stage") || null;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(5, parseInt(url.searchParams.get("limit") || "20")));
  const offset = (page - 1) * limit;

  try {
    // 1. All of this user's pipeline entries (small — one founder's tracking)
    const { data: entries, error: entriesError } = await sp
      .from("user_pipeline_entries")
      .select(
        "id, investor_id, stage, created_at, updated_at, expected_amount, probability, lost_reason, stage_entered_at"
      )
      .eq("user_id", user.id);
    if (entriesError) throw entriesError;
    const userEntries = (entries || []) as unknown as {
      id: string;
      investor_id: string;
      stage: PipelineStageId;
      created_at: string;
      updated_at: string | null;
      expected_amount: number | string | null;
      probability: number | null;
      lost_reason: string | null;
      stage_entered_at: string | null;
    }[];

    // 2. Counts are the founder's own entries. The pipeline is what this user
    //    moved — not what the shared corpus happens to be qualified as. A new
    //    account with nothing tracked shows zero here, which is the truth: the
    //    old code added all 18,995 batch-qualified records to every founder's
    //    stage counts, so "your pipeline" opened at 12,108 qualified investors
    //    on day one.
    const explicitCounts: Record<string, number> = {};
    for (const e of userEntries) {
      explicitCounts[e.stage] = (explicitCounts[e.stage] || 0) + 1;
    }

    const stageCounts: Record<string, number> = {};
    for (const s of PIPELINE_STAGES) {
      stageCounts[s.id] = explicitCounts[s.id] || 0;
    }

    // 3. The database's batch qualification is a different fact about a
    //    different population, so it is returned separately and labelled with
    //    its source rather than folded into the counts above.
    const datasetByReadiness: Record<string, number> = {};
    await Promise.all(
      DB_READINESS_VALUES.map(async (r) => {
        const { count } = await sp
          .from("investors")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("outreach_readiness", r);
        datasetByReadiness[r] = count || 0;
      })
    );

    const datasetByStage: Record<string, number> = {};
    for (const [readiness, cnt] of Object.entries(datasetByReadiness)) {
      const s = READINESS_TO_STAGE[readiness];
      if (s) datasetByStage[s] = (datasetByStage[s] || 0) + cnt;
    }

    const dataset = {
      source: "database_batch_qualification" as const,
      label: "Database batch qualification — every record, not your pipeline",
      byStage: datasetByStage,
      total: Object.values(datasetByReadiness).reduce((sum, n) => sum + n, 0),
    };

    // ── Round targets, expected money and conversion ──
    // One computation feeds the pipeline header, the dashboard and reports, so
    // "committed" cannot mean two different numbers in two places.
    const { data: profileRow } = await sp
      .from("company_profiles")
      .select("funding_amount, target_valuation, round_type, target_cheque_min, target_cheque_max")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: eventRows } = await sp
      .from("pipeline_events")
      .select("investor_id, to_stage, created_at")
      .eq("user_id", user.id);

    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

    const round = computeRoundMetrics({
      targets: {
        targetAmount: num(profileRow?.funding_amount),
        targetValuation: num(profileRow?.target_valuation),
        instrument: (profileRow?.round_type as string | null) ?? null,
        chequeMin: num(profileRow?.target_cheque_min),
        chequeMax: num(profileRow?.target_cheque_max),
      },
      entries: userEntries.map(
        (e): RoundEntry => ({
          id: e.id,
          investorId: e.investor_id,
          stage: e.stage,
          expectedAmount: num(e.expected_amount),
          probability: num(e.probability),
          lostReason: e.lost_reason,
          stageEnteredAt: e.stage_entered_at,
          createdAt: e.created_at,
        })
      ),
      events: (eventRows || []).map(
        (e): PipelineMoveEvent => ({
          investorId: e.investor_id as string,
          toStage: e.to_stage as string | null,
          createdAt: e.created_at as string,
        })
      ),
    });

    // ── Investors for a specific stage (if requested) ──
    let investors: any[] = [];
    let total = 0;

    if (stage) {
      if (!isPipelineStageId(stage)) {
        return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
      }
      const stageId = stage as PipelineStageId;

      // Only entries: this stage belongs to the founder, so no corpus rows are
      // mixed in. Pagination is on the entries themselves.
      const { data: entryRows, error: listError } = await sp
        .from("user_pipeline_entries")
        .select(
          `id, stage, created_at, expected_amount, probability, investor:investors!inner(${INVESTOR_FIELDS}, investor_firms(name))`
        )
        .eq("user_id", user.id)
        .eq("stage", stageId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (listError) throw listError;

      investors = ((entryRows || []) as unknown as EntryRow[]).map((row) =>
        toUiInvestor(
          {
            ...(row.investor as Record<string, any>),
            entry_created_at: row.created_at,
            expected_amount: row.expected_amount === null ? null : Number(row.expected_amount),
            probability: row.probability === null ? null : Number(row.probability),
          },
          stageId
        )
      );
      total = explicitCounts[stageId] || 0;
    }

    return NextResponse.json({
      stages: PIPELINE_STAGES.map((s) => ({ ...s, count: stageCounts[s.id] || 0 })),
      investors,
      total,
      page,
      limit,
      hasPipelineStage: true,
      // Task 2.5: one sentence that explains what the counts are.
      countsExplanation:
        "Counts are investors you have moved. The database's batch " +
        "qualification is reported separately and is not your pipeline.",
      dataset,
      round,
    });
  } catch (err) {
    console.error("Pipeline API error:", err);
    return NextResponse.json({ error: "Failed to load pipeline" }, { status: 500 });
  }
}

// ── POST: move investor to a new stage (per-user; shared table untouched) ──
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const sp = getSp();

  try {
    const body = await request.json();
    const { investorId, stage, notes } = body;

    if (!investorId || !stage) {
      return NextResponse.json({ error: "investorId and stage are required" }, { status: 400 });
    }

    if (!isPipelineStageId(stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }
    const stageId = stage as PipelineStageId;

    // Validate the investor exists (FK will also enforce this)
    const { data: investor, error: invError } = await sp
      .from("investors")
      .select("id")
      .eq("id", investorId)
      .maybeSingle();
    if (invError) throw invError;
    if (!investor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 });
    }

    // Previous stage (for the audit event)
    const { data: existing } = await sp
      .from("user_pipeline_entries")
      .select("id, stage")
      .eq("user_id", user.id)
      .eq("investor_id", investorId)
      .maybeSingle();

    if (existing?.stage === stageId) {
      return NextResponse.json({ success: true, investorId, stage: stageId, unchanged: true });
    }

    const { error: upsertError } = await sp.from("user_pipeline_entries").upsert(
      {
        user_id: user.id,
        investor_id: investorId,
        stage: stageId,
        ...(notes !== undefined ? { notes } : {}),
      },
      { onConflict: "user_id,investor_id" }
    );
    if (upsertError) throw upsertError;

    // Audit trail — non-critical if it fails
    const eventResult = await sp.from("pipeline_events").insert({
      user_id: user.id,
      investor_id: investorId,
      entry_id: existing?.id ?? null,
      from_stage: existing?.stage ?? null,
      to_stage: stageId,
      ...(notes !== undefined ? { notes } : {}),
    });
    if (eventResult.error && process.env.NODE_ENV !== "production") {
      console.warn("[pipeline] event log skipped:", eventResult.error.message);
    }

    return NextResponse.json({ success: true, investorId, stage: stageId });
  } catch (err: any) {
    console.error("Pipeline move error:", err);
    const message =
      err?.code === "23503" ? "Investor not found" : "Failed to update pipeline stage";
    return NextResponse.json({ error: message }, { status: err?.code === "23503" ? 404 : 500 });
  }
}
