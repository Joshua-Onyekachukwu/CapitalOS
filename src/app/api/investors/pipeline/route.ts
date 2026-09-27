// =============================================
// Fundraising Pipeline API — per-user (Phase 2)
// =============================================
// Pipeline state lives in `user_pipeline_entries` (per founder) with an
// audit trail in `pipeline_events`. Investors WITHOUT an explicit entry
// fall back to a default stage derived from the shared `outreach_readiness`
// column. The shared investors table is never written by this API.
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
    firm_name: flattenFirmName(inv),
    investor_firms: undefined,
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
      .select("id, stage, created_at, investor:investors(outreach_readiness)")
      .eq("user_id", user.id);
    if (entriesError) throw entriesError;
    const userEntries = (entries || []) as unknown as {
      id: string;
      stage: PipelineStageId;
      created_at: string;
      investor: { outreach_readiness: string } | null;
    }[];

    // 2. Default-bucket counts from shared readiness (5 indexed-able counts)
    const rawByReadiness: Record<string, number> = {};
    await Promise.all(
      DB_READINESS_VALUES.map(async (r) => {
        const { count } = await sp
          .from("investors")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("outreach_readiness", r);
        rawByReadiness[r] = count || 0;
      })
    );

    // 3. Combine: explicit entries own their investor; defaults apply to the rest
    const explicitCounts: Record<string, number> = {};
    const defaultDeltas: Record<string, number> = {};
    const trackedIds: string[] = [];
    // entries need investor ids for exclusion — fetch separately (cheap)
    const { data: idRows } = await sp
      .from("user_pipeline_entries")
      .select("investor_id")
      .eq("user_id", user.id);
    for (const row of idRows || []) trackedIds.push(row.investor_id);

    for (const e of userEntries) {
      explicitCounts[e.stage] = (explicitCounts[e.stage] || 0) + 1;
      const mapped = e.investor ? READINESS_TO_STAGE[e.investor.outreach_readiness] : undefined;
      if (mapped && mapped !== e.stage) {
        defaultDeltas[mapped] = (defaultDeltas[mapped] || 0) - 1;
      }
    }

    const rawByStage: Record<string, number> = {};
    for (const [readiness, cnt] of Object.entries(rawByReadiness)) {
      const s = READINESS_TO_STAGE[readiness];
      if (s) rawByStage[s] = (rawByStage[s] || 0) + cnt;
    }

    const stageCounts: Record<string, number> = {};
    for (const s of PIPELINE_STAGES) {
      stageCounts[s.id] =
        (explicitCounts[s.id] || 0) +
        Math.max(0, (rawByStage[s.id] || 0) + (defaultDeltas[s.id] || 0));
    }

    // ── Investors for a specific stage (if requested) ──
    let investors: any[] = [];
    let total = 0;

    if (stage) {
      if (!isPipelineStageId(stage)) {
        return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
      }
      const stageId = stage as PipelineStageId;

      // Explicit entries at this stage (always shown first)
      const { data: entryRows, error: listError } = await sp
        .from("user_pipeline_entries")
        .select(
          `id, stage, created_at, investor:investors!inner(${INVESTOR_FIELDS}, investor_firms(name))`
        )
        .eq("user_id", user.id)
        .eq("stage", stageId)
        .order("created_at", { ascending: false });
      if (listError) throw listError;

      const explicitRows = ((entryRows || []) as unknown as EntryRow[]).map((row) =>
        toUiInvestor(
          { ...(row.investor as Record<string, any>), entry_created_at: row.created_at },
          stageId
        )
      );

      // Default bucket: shared-readiness investors without explicit entries
      const readinessValues = DB_READINESS_VALUES.filter((r) => READINESS_TO_STAGE[r] === stageId);
      let defaultRows: any[] = [];
      let defaultTotal = 0;

      if (readinessValues.length > 0) {
        let query = sp
          .from("investors")
          .select(`${INVESTOR_FIELDS}, investor_firms(name)`, { count: "exact" })
          .eq("is_active", true)
          .in("outreach_readiness", readinessValues);

        // Investors the user explicitly tracks are owned by the explicit bucket.
        // (URL-length guard: skip exclusion only in the pathological case.)
        if (trackedIds.length > 0 && trackedIds.length <= 500) {
          query = query.not("id", "in", `(${trackedIds.join(",")})`);
        }

        query = query
          .order("fit_score", { ascending: false, nullsFirst: false })
          .range(offset, offset + limit - 1);

        const { data, count, error } = await query;
        if (error) throw error;
        defaultRows = (data || []).map((inv: any) => toUiInvestor(inv, stageId));
        defaultTotal = count || 0;
      }

      investors = [...explicitRows, ...defaultRows];
      total = (explicitCounts[stageId] || 0) + Math.max(0, (rawByStage[stageId] || 0) + (defaultDeltas[stageId] || 0));
      // keep defaultTotal referenced for shape parity
      void defaultTotal;
    }

    return NextResponse.json({
      stages: PIPELINE_STAGES.map((s) => ({ ...s, count: stageCounts[s.id] || 0 })),
      investors,
      total,
      page,
      limit,
      hasPipelineStage: true,
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
