import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST — Add a note to an investor's timeline
// Notes live in data_change_log with field_name='note' and
// change_type='update' (the table's CHECK constraint only allows
// create/update/merge/delete/revert; the UI renders these rows
// generically as "<field> updated"). Writes to that table are
// service-role-only under RLS, so notes are attributed server-side here
// instead of being inserted directly from the browser client.
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.api);
  if (rateLimitResponse) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
  }

  try {
    const body = await request.json();
    const investorId: string | undefined = body?.investorId;
    const note: string | undefined =
      typeof body?.note === "string" ? body.note.trim() : undefined;

    if (!investorId || !note) {
      return NextResponse.json(
        { error: "investorId and note are required" },
        { status: 400 }
      );
    }
    if (note.length > 5000) {
      return NextResponse.json(
        { error: "note exceeds 5000 characters" },
        { status: 400 }
      );
    }

    const sp = getSupabase();

    // Validate the investor exists (global product dataset)
    const { data: investor } = await sp
      .from("investors")
      .select("id")
      .eq("id", investorId)
      .maybeSingle();
    if (!investor) {
      return NextResponse.json(
        { error: "Investor not found" },
        { status: 404 }
      );
    }

    const { data, error } = await sp
      .from("data_change_log")
      .insert({
        investor_id: investorId,
        field_name: "note",
        new_value: note,
        // Constraints: change_type CHECK allows create/update/merge/
        // delete/revert ('note' would violate it), and the source_type
        // enum's member is 'manual_entry' ('manual' would violate it) —
        // either mismatch makes every note insert fail with 500.
        change_type: "update",
        source_type: "manual_entry",
        detected_by: user.id,
      })
      .select("id, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ note: data }, { status: 201 });
  } catch (err) {
    console.error("[api/investors/notes] POST failed:", err);
    return NextResponse.json(
      { error: "Failed to add note" },
      { status: 500 }
    );
  }
}
