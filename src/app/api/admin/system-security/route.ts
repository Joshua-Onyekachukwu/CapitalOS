// =============================================
// Admin — Security Nightly History
// =============================================
// Backs the security card on /admin/system: recent outcomes of the nightly
// security suites (access-control + authflow) recorded by
// POST /api/cron/security-alert into background_jobs (job_type
// 'security_nightly'). Read-only; requireAdmin-gated.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { getUserRole } from "@/lib/roles";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  const roleInfo = await getUserRole(user.id, user.email || "");
  if (!roleInfo.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const sp = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await sp
    .from("background_jobs")
    .select("id, status, output, error_message, started_at, completed_at")
    .eq("job_type", "security_nightly")
    .order("started_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("[admin/system-security] query failed:", error.message);
    return NextResponse.json({ runs: [], summary: null });
  }

  const runs = (data || []).map((r: any) => ({
    id: r.id,
    status: r.status as "completed" | "failed",
    startedAt: r.started_at,
    detail: r.output?.detail || r.error_message || null,
    runUrl: r.output?.run_url || null,
    sha: r.output?.sha || null,
  }));

  // Passing streak: consecutive completed runs from the most recent one.
  let streak = 0;
  for (const r of runs) {
    if (r.status !== "completed") break;
    streak++;
  }
  const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
  const failures30d = runs.filter(
    (r) => r.status === "failed" && new Date(r.startedAt).getTime() >= thirtyDaysAgo
  ).length;

  return NextResponse.json({
    runs,
    summary: {
      passingStreak: streak,
      failures30d,
      lastRun: runs[0] || null,
    },
  });
}
