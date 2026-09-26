// =============================================
// Fundraising Pipeline API
// =============================================
// Returns investors grouped by their pipeline_stage.
// Falls back to outreach_readiness if pipeline_stage column does not exist.
//
// GET  /api/investors/pipeline          → stage summary + paginated investors
// POST /api/investors/pipeline          → move investor to a new stage

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

// ── Stage definitions — single source of truth ──
export const PIPELINE_STAGES = [
  { id: "discovered",    label: "Discovered",    color: "bg-gray-400",    description: "Found in database" },
  { id: "qualified",     label: "Qualified",     color: "bg-blue-500",    description: "Reviewed and looks relevant" },
  { id: "researching",   label: "Researching",   color: "bg-indigo-500",  description: "Deep research in progress" },
  { id: "outreach",      label: "Outreach Ready", color: "bg-lime-500",   description: "Ready to contact" },
  { id: "contacted",     label: "Contacted",     color: "bg-purple-500",  description: "First email sent" },
  { id: "meeting",       label: "Meeting",       color: "bg-amber-500",   description: "Meeting scheduled or held" },
  { id: "follow_up",     label: "Follow-up",     color: "bg-orange-500",  description: "Post-meeting follow-up" },
  { id: "due_diligence", label: "Due Diligence", color: "bg-cyan-500",    description: "Investor is diligencing" },
  { id: "term_sheet",    label: "Term Sheet",    color: "bg-green-600",   description: "Term sheet received" },
  { id: "closed",        label: "Closed",        color: "bg-green-700",   description: "Investment closed" },
  { id: "passed",        label: "Passed",        color: "bg-red-400",     description: "Investor passed or not a fit" },
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number]["id"];

// Maps outreach_readiness → pipeline_stage for migration/fallback
const READINESS_TO_STAGE: Record<string, PipelineStageId> = {
  not_ready:            "discovered",
  needs_verification:   "qualified",
  ready:                "outreach",
  contacted:            "contacted",
  do_not_contact:       "passed",
  low_priority:         "discovered",
  interested:           "meeting",
};

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── GET: return stage summary + investors for a given stage ──
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
    // Check whether pipeline_stage column exists by trying to select it
    // If it doesn't exist Supabase returns an error we catch and fall back
    let hasPipelineStage = false;
    try {
      const probe = await sp.from("investors").select("pipeline_stage").limit(1);
      hasPipelineStage = !probe.error;
    } catch {
      hasPipelineStage = false;
    }

    const stageCol = hasPipelineStage ? "pipeline_stage" : "outreach_readiness";

    // ── Stage summary counts ──
    const stageCounts: Record<string, number> = {};
    for (const s of PIPELINE_STAGES) {
      stageCounts[s.id] = 0;
    }

    // Fetch per-stage counts in parallel (Supabase doesn't support GROUP BY directly via PostgREST)
    const countPromises = PIPELINE_STAGES.map(async (s) => {
      let dbStageValue: string = s.id;
      if (!hasPipelineStage) {
        // map pipeline stage id back to outreach_readiness values
        const matches = Object.entries(READINESS_TO_STAGE)
          .filter(([, v]) => v === s.id)
          .map(([k]) => k);
        if (matches.length === 0) return;
        // Count all matching readiness values
        let count = 0;
        for (const m of matches) {
          const r = await sp.from("investors").select("id", { count: "exact", head: true }).eq("outreach_readiness", m);
          count += r.count || 0;
        }
        stageCounts[s.id] = count;
      } else {
        const r = await sp.from("investors").select("id", { count: "exact", head: true }).eq("pipeline_stage", s.id);
        stageCounts[s.id] = r.count || 0;
      }
    });
    await Promise.all(countPromises);

    // ── Investors for a specific stage (if requested) ──
    let investors: any[] = [];
    let total = 0;

    if (stage) {
      const validStage = PIPELINE_STAGES.find((s) => s.id === stage);
      if (!validStage) {
        return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
      }

      let query = sp
        .from("investors")
        .select(
          "id, full_name, investor_type, fit_score, outreach_readiness, firm_name, country, city, email, linkedin_url, investment_stages, investment_sectors, created_at" +
          (hasPipelineStage ? ", pipeline_stage" : ""),
          { count: "exact" }
        )
        .order("fit_score", { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

      if (hasPipelineStage) {
        query = query.eq("pipeline_stage", stage);
      } else {
        // Map stage back to readiness values
        const readinessValues = Object.entries(READINESS_TO_STAGE)
          .filter(([, v]) => v === stage)
          .map(([k]) => k);

        if (readinessValues.length === 1) {
          query = query.eq("outreach_readiness", readinessValues[0]);
        } else if (readinessValues.length > 1) {
          query = query.in("outreach_readiness", readinessValues);
        } else {
          // Stage doesn't map — return empty
          return NextResponse.json({
            stages: PIPELINE_STAGES.map((s) => ({ ...s, count: stageCounts[s.id] || 0 })),
            investors: [],
            total: 0,
            page,
            limit,
            hasPipelineStage,
          });
        }
      }

      const { data, count, error } = await query;
      if (error) throw error;
      investors = (data || []).map((inv: any) => ({
        ...inv,
        pipeline_stage: hasPipelineStage ? inv.pipeline_stage : READINESS_TO_STAGE[inv.outreach_readiness] || "discovered",
      }));
      total = count || 0;
    }

    return NextResponse.json({
      stages: PIPELINE_STAGES.map((s) => ({ ...s, count: stageCounts[s.id] || 0 })),
      investors,
      total,
      page,
      limit,
      hasPipelineStage,
    });
  } catch (err) {
    console.error("Pipeline API error:", err);
    return NextResponse.json({ error: "Failed to load pipeline" }, { status: 500 });
  }
}

// ── POST: move investor to a new stage ──
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const sp = getSp();

  try {
    const body = await request.json();
    const { investorId, stage } = body;

    if (!investorId || !stage) {
      return NextResponse.json({ error: "investorId and stage are required" }, { status: 400 });
    }

    const validStage = PIPELINE_STAGES.find((s) => s.id === stage);
    if (!validStage) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }

    // Try updating pipeline_stage first
    let hasPipelineStage = false;
    try {
      const probe = await sp.from("investors").select("pipeline_stage").limit(1);
      hasPipelineStage = !probe.error;
    } catch {
      hasPipelineStage = false;
    }

    // Map stage to outreach_readiness for fallback / always sync
    const readinessMap: Record<string, string> = {
      discovered:    "not_ready",
      qualified:     "needs_verification",
      researching:   "needs_verification",
      outreach:      "ready",
      contacted:     "contacted",
      meeting:       "interested",
      follow_up:     "contacted",
      due_diligence: "interested",
      term_sheet:    "interested",
      closed:        "contacted",
      passed:        "do_not_contact",
    };

    const updateData: Record<string, string> = {
      outreach_readiness: readinessMap[stage] || "not_ready",
    };

    if (hasPipelineStage) {
      updateData.pipeline_stage = stage;
    }

    const { error } = await sp
      .from("investors")
      .update(updateData)
      .eq("id", investorId);

    if (error) throw error;

    // Log the stage change (optional — non-fatal if table doesn't exist)
    try {
      await sp.from("pipeline_events").insert({
        investor_id: investorId,
        user_id: user.id,
        from_stage: null,
        to_stage: stage,
        created_at: new Date().toISOString(),
      });
    } catch {
      // pipeline_events table not yet created — non-critical
    }

    return NextResponse.json({ success: true, investorId, stage });
  } catch (err) {
    console.error("Pipeline move error:", err);
    return NextResponse.json({ error: "Failed to update pipeline stage" }, { status: 500 });
  }
}
