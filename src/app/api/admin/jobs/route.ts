/**
 * Admin Jobs Management API
 *
 * GET    /api/admin/jobs      — List all jobs (admin sees everything)
 * POST   /api/admin/jobs      — Create any job type (including admin-only)
 *
 * POST Body:
 *   { "type": "apollo_import", "payload": { "csvData": [...], "sourceLabel": "manual" } }
 *   { "type": "investor_qualification", "payload": {} }
 *   { "type": "investor_dedup", "payload": {} }
 *   { "type": "email_polling", "payload": {} }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { createJob, listJobs } from "@/lib/jobs/runner";

const ALL_JOB_TYPES = new Set([
  "apollo_import",
  "investor_qualification",
  "investor_dedup",
  "investor_enrichment",
  "email_polling",
  "edgar_scrape",
  "process_raw_records",
]);

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  try {
    const sp = request.nextUrl.searchParams;
    const type = sp.get("type") || undefined;
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "50")));

    const jobs = await listJobs(type, limit);

    return NextResponse.json({ jobs, total: jobs.length });
  } catch (err) {
    console.error("Admin jobs list error:", err);
    return NextResponse.json({ error: "Failed to list jobs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.import);
  if (rateLimitResponse) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
  }

  try {
    const body = await request.json();
    const { type, payload = {} } = body;

    if (!type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    if (!ALL_JOB_TYPES.has(type)) {
      return NextResponse.json(
        { error: `Unknown job type: ${type}` },
        { status: 400 }
      );
    }

    const jobId = await createJob(type, payload, user.id);

    return NextResponse.json({
      success: true,
      jobId,
      message: `Admin job "${type}" created`,
      type,
    });
  } catch (err) {
    console.error("Admin job creation error:", err);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}
