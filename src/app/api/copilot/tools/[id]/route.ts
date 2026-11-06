// =============================================
// POST /api/copilot/tools/[id]
// =============================================
// Decides one pending tool run. Approving executes it exactly once; rejecting
// records the decision and never executes. Ownership and status are both
// checked before execution, so a run belonging to another user, or one already
// decided, cannot be replayed into a second write.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";
import { getTool } from "@/lib/copilot/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action === "approve" ? "approve" : body.action === "reject" ? "reject" : null;

  if (!action) {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }

  const sp = getSp();
  const { data: run, error: findError } = await sp
    .from("copilot_tool_runs")
    .select("id, user_id, tool_name, args, status, conversation_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (findError) {
    console.error("[copilot/tools] lookup failed:", findError.message);
    return NextResponse.json({ error: "Could not load the action" }, { status: 500 });
  }
  if (!run) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }
  if (run.status !== "pending") {
    return NextResponse.json(
      { error: `This action is already ${run.status}` },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  if (action === "reject") {
    const { error } = await sp
      .from("copilot_tool_runs")
      .update({ status: "rejected", decided_at: now })
      .eq("id", run.id)
      .eq("user_id", user.id)
      .eq("status", "pending");
    if (error) return NextResponse.json({ error: "Could not reject the action" }, { status: 500 });
    return NextResponse.json({ status: "rejected" });
  }

  const tool = getTool(run.tool_name);
  if (!tool) {
    await sp
      .from("copilot_tool_runs")
      .update({ status: "failed", error: "Unknown tool", decided_at: now })
      .eq("id", run.id);
    return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
  }

  // Claim the approval before executing. The status filter means two concurrent
  // approvals cannot both win: the second update matches zero rows.
  const { data: claimed, error: claimError } = await sp
    .from("copilot_tool_runs")
    .update({ status: "approved", decided_at: now })
    .eq("id", run.id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("id");

  if (claimError || !claimed || claimed.length === 0) {
    return NextResponse.json({ error: "This action was already decided" }, { status: 409 });
  }

  try {
    const result = await tool.execute(user.id, (run.args ?? {}) as Record<string, unknown>);
    await sp
      .from("copilot_tool_runs")
      .update({ status: "executed", result, executed_at: new Date().toISOString() })
      .eq("id", run.id);
    return NextResponse.json({ status: "executed", result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool execution failed";
    await sp
      .from("copilot_tool_runs")
      .update({ status: "failed", error: message, executed_at: new Date().toISOString() })
      .eq("id", run.id);
    return NextResponse.json({ status: "failed", error: message }, { status: 500 });
  }
}
