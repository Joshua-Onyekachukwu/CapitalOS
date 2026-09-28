// =============================================
// Security Nightly Alert Ingest
// =============================================
// Records the outcome of the scheduled GitHub Actions access-control run
// (.github/workflows/security-nightly.yml) into background_jobs so failures
// surface in /admin/intelligence (job_status rollup + recent failures).
//
// Auth: Bearer CRON_SECRET (same gate as the other cron routes) — this is
// machine-to-machine, never user-facing.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const JOB_TYPE = "security_nightly";

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawStatus: string = body?.status || "";
    const status = rawStatus === "completed" ? "completed" : "failed";
    const runUrl: string | undefined =
      typeof body?.runUrl === "string" ? body.runUrl : undefined;
    const sha: string | undefined =
      typeof body?.sha === "string" ? body.sha : undefined;

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const output: Record<string, unknown> = { via: "github-actions" };
    if (runUrl) output.run_url = runUrl;
    if (sha) output.sha = sha;

    const { error } = await sp.from("background_jobs").insert({
      job_type: JOB_TYPE,
      status,
      input: { scheduled: true },
      output,
      error_message: status === "failed" ? "Nightly access-control suite failed — see GitHub issue 'security: access-control suite failing against production'" : null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    if (error) throw error;

    return NextResponse.json({ ok: true, jobType: JOB_TYPE, status });
  } catch (err) {
    console.error("[api/cron/security-alert] record failed:", err);
    return NextResponse.json(
      { error: "Failed to record security run" },
      { status: 500 }
    );
  }
}
