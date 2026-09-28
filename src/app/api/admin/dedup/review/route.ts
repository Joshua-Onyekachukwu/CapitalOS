import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST — Review decision on a duplicate candidate.
// browser-side writes to duplicate_candidates are blocked by RLS by design;
// admin decisions go through this audited endpoint instead.
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
  if (rateLimitResponse) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
  }

  try {
    const body = await request.json();
    const candidateId: string | undefined = body?.candidateId;
    const action: string | undefined = body?.action;
    const validActions = ["approved", "rejected"] as const;

    if (!candidateId || !validActions.includes(action as (typeof validActions)[number])) {
      return NextResponse.json(
        { error: `candidateId and action (${validActions.join("|")}) are required` },
        { status: 400 }
      );
    }

    const sp = getSupabase();

    // Only pending candidates can be decided; prevents double-deciding
    // or touching already-merged/processed rows.
    const { data: candidate } = await sp
      .from("duplicate_candidates")
      .select("id, status, investor_a_name, investor_b_name")
      .eq("id", candidateId)
      .maybeSingle();

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }
    if (candidate.status !== "pending") {
      return NextResponse.json(
        { error: `Candidate already ${candidate.status}` },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const { error: updateError } = await sp
      .from("duplicate_candidates")
      .update({
        status: action,
        reviewed_by: user.id,
        reviewed_at: now,
      })
      .eq("id", candidateId);

    if (updateError) throw updateError;

    await sp.from("admin_audit_log").insert({
      user_id: user.id,
      action: `duplicate_review_${action}`,
      entity_type: "duplicate_candidate",
      entity_id: candidateId,
      details: {
        status: candidate.status,
        investor_a: candidate.investor_a_name,
        investor_b: candidate.investor_b_name,
      },
    });

    return NextResponse.json({ ok: true, status: action });
  } catch (err) {
    console.error("[api/admin/dedup/review] POST failed:", err);
    return NextResponse.json(
      { error: "Review action failed" },
      { status: 500 }
    );
  }
}
