/**
 * Background Jobs API
 *
 * GET  /api/jobs              — List recent jobs
 * POST /api/jobs              — Create a new job
 *
 * Query Params:
 *   type   — Filter by job type
 *   limit  — Max results (default 20)
 *
 * POST Body:
 *   { "type": "apollo_import", "payload": { ... } }
 *   { "type": "investor_qualification", "payload": { ... } }
 *   { "type": "investor_dedup", "payload": {} }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { createJob, listJobs } from "@/lib/jobs/runner";

// Allowed job types that regular users can create
const ALLOWED_USER_JOBS = new Set([
  "investor_qualification",
  "investor_dedup",
]);

// Admin-only job types
const ADMIN_ONLY_JOBS = new Set([
  "apollo_import",
  "email_polling",
  "edgar_scrape",
  "process_raw_records",
  "investor_enrichment",
]);

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const sp = request.nextUrl.searchParams;
    const type = sp.get("type") || undefined;
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "20")));

    const jobs = await listJobs(type, limit);

    return NextResponse.json({ jobs });
  } catch (err) {
    console.error("Jobs list error:", err);
    return NextResponse.json({ error: "Failed to list jobs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
  if (rateLimitResponse) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
  }

  try {
    const body = await request.json();
    const { type, payload = {} } = body;

    if (!type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    // Check authorization
    if (ADMIN_ONLY_JOBS.has(type)) {
      return NextResponse.json(
        { error: "This job type requires admin access" },
        { status: 403 }
      );
    }

    if (!ALLOWED_USER_JOBS.has(type)) {
      return NextResponse.json(
        { error: `Unknown job type: ${type}. Allowed: ${[...ALLOWED_USER_JOBS].join(", ")}` },
        { status: 400 }
      );
    }

    const jobId = await createJob(type, payload, user.id);

    return NextResponse.json({
      success: true,
      jobId,
      message: `Job "${type}" created and queued for processing`,
      type,
    });
  } catch (err) {
    console.error("Job creation error:", err);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}
