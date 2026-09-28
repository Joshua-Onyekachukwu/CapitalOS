// =============================================
// Admin Investor Intelligence API
// =============================================
// Powers the admin intelligence dashboard. All data comes from
// admin_intelligence_overview() (live DB stats) or real scans — no mock
// numbers anywhere.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { logAdminAction } from "@/lib/services/admin/audit";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  try {
    const sp = getSp();
    const { data, error } = await sp.rpc("admin_intelligence_overview");
    if (error) throw error;
    return NextResponse.json(data ?? {});
  } catch (err) {
    console.error("Intelligence overview error:", err);
    return NextResponse.json({ error: "Failed to load overview" }, { status: 500 });
  }
}

// POST actions: duplicate scan, JSONL export
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json().catch(() => ({}));
    const action: string = body.action || "";
    const sp = getSp();

    // ── Duplicate scan ──
    // Name-normalized exact matches are high-confidence duplicates (same
    // canonical name from different sources). Trigram similarity catches
    // near-variants; those land as 'pending' review items, never auto-merged.
    if (action === "scan_duplicates") {
      const threshold = Math.min(0.95, Math.max(0.75, parseFloat(body.similarity) || 0.85));
      const limit = Math.min(500, Math.max(10, parseInt(body.limit) || 200));

      const { data, error } = await sp.rpc("find_duplicate_investors", {
        p_similarity: threshold,
        p_limit: limit,
      });
      if (error) throw error;
      const result = data ?? { groups: [], created: 0 };
      logAdminAction({
        userId: user.id,
        action: "duplicate_scan",
        entityType: "investor",
        details: { created: result.created, similarity: threshold },
        ip: request.headers.get("x-forwarded-for"),
      });
      return NextResponse.json(result);
    }

    // ── Pending duplicate review queue (with names) ──
    if (action === "list_duplicates") {
      const limit = Math.min(200, Math.max(10, parseInt(body.limit) || 100));
      const { data, error } = await sp
        .from("duplicate_candidates")
        .select("id, confidence, match_signals, created_at, investor_a_id, investor_b_id, investors:investor_a_id(full_name, country), loser:investor_b_id(full_name, country)")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return NextResponse.json({
        candidates: (data || []).map((d: any) => ({
          id: d.id,
          confidence: d.confidence,
          name: d.match_signals?.name || null,
          a: { id: d.investor_a_id, fullName: d.investors?.full_name, country: d.investors?.country },
          b: { id: d.investor_b_id, fullName: d.loser?.full_name, country: d.loser?.country },
          createdAt: d.created_at,
        })),
      });
    }

    // ── Merge a reviewed duplicate pair (destructive; audited) ──
    if (action === "merge") {
      const keeper: string = body.keeperId;
      const loser: string = body.loserId;
      if (!keeper || !loser || keeper === loser) {
        return NextResponse.json({ error: "keeperId and loserId (distinct) required" }, { status: 400 });
      }
      const { data, error } = await sp.rpc("merge_investors", { p_keeper: keeper, p_loser: loser });
      if (error) throw error;
      logAdminAction({
        userId: user.id,
        action: "merge_investors",
        entityType: "investor",
        entityId: keeper,
        details: { loser, result: data },
        ip: request.headers.get("x-forwarded-for"),
      });
      return NextResponse.json({ success: true, ...data });
    }

    // ── Apollo enrichment run history (background_jobs) ──
    if (action === "apollo_runs") {
      const limit = Math.min(50, Math.max(1, parseInt(body.limit) || 20));
      const { data, error } = await sp
        .from("background_jobs")
        .select("id, status, output, error_message, started_at, completed_at")
        .eq("job_type", "apollo_enrichment")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return NextResponse.json({
        runs: (data || []).map((j: any) => ({
          id: j.id,
          status: j.status,
          createdAt: j.started_at,
          durationMs: j.started_at && j.completed_at ? new Date(j.completed_at).getTime() - new Date(j.started_at).getTime() : null,
          targets: j.output?.targets ?? null,
          matched: j.output?.matched ?? null,
          ambiguous: j.output?.ambiguous ?? null,
          emailsFound: j.output?.emailsFound ?? null,
          estimatedCredits: j.output?.estimatedCredits ?? null,
          apiCalls: j.output?.apiCalls ?? null,
          error: j.error_message || j.output?.error || null,
        })),
      });
    }

    // ── Background job status rollup (all job types) ──
    if (action === "job_status") {
      const { data: byType, error: e1 } = await sp
        .from("background_jobs")
        .select("job_type, status");
      if (e1) throw e1;
      const counts: Record<string, Record<string, number>> = {};
      for (const j of byType || []) {
        counts[j.job_type] = counts[j.job_type] || {};
        counts[j.job_type][j.status] = (counts[j.job_type][j.status] || 0) + 1;
      }
      const { data: failures, error: e2 } = await sp
        .from("background_jobs")
        .select("job_type, error_message, created_at")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(10);
      if (e2) throw e2;
      return NextResponse.json({
        counts,
        recentFailures: (failures || []).map((f: any) => ({ jobType: f.job_type, error: f.error_message, createdAt: f.created_at })),
      });
    }

    // ── JSONL export (streams the compact normalized dataset) ──
    if (action === "export") {
      const { format } = body;
      if (format !== "jsonl") {
        return NextResponse.json({ error: "Unsupported format — use jsonl" }, { status: 400 });
      }

      const PAGE = 1000;
      let offset = 0;
      const encoder = new TextEncoder();
      let total = 0;

      const stream = new ReadableStream({
        async start(controller) {
          try {
            for (;;) {
              const { data, error } = await sp
                .from("investors")
                .select("id, full_name, name_normalized, investor_type, investment_stages, investment_sectors, investment_geographies, country, city, website_url, linkedin_url, email, fit_score, data_quality_score, outreach_readiness, verification_status, source, source_provider, source_id, last_verified_at, is_active, created_at, updated_at")
                .order("created_at")
                .range(offset, offset + PAGE - 1);
              if (error) throw error;
              if (!data || data.length === 0) break;

              for (const row of data) {
                controller.enqueue(encoder.encode(JSON.stringify(row) + "\n"));
                total++;
              }
              offset += PAGE;
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new NextResponse(stream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Content-Disposition": `attachment; filename="capitalos-investors-${new Date().toISOString().slice(0, 10)}.jsonl"`,
          "X-Record-Count": String(total),
        },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Intelligence action error:", err);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
