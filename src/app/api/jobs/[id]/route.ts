/**
 * Job Detail API
 *
 * GET    /api/jobs/:id       — Get job status and progress
 * DELETE /api/jobs/:id       — Cancel a pending/running job
 * POST   /api/jobs/:id       — Retry a failed/dead job
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { getJob, cancelJob, retryJob } from "@/lib/jobs/runner";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
  if (rateLimitResponse) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
  }

  try {
    const { id } = await params;
    const job = await getJob(id);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (err) {
    console.error("Job detail error:", err);
    return NextResponse.json({ error: "Failed to get job" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
  if (rateLimitResponse) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
  }

  try {
    const { id } = await params;
    const cancelled = await cancelJob(id);

    if (!cancelled) {
      return NextResponse.json(
        { error: "Job not found or not cancellable" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Job cancelled" });
  } catch (err) {
    console.error("Job cancel error:", err);
    return NextResponse.json({ error: "Failed to cancel job" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
  if (rateLimitResponse) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
  }

  try {
    const { id } = await params;
    const retried = await retryJob(id);

    if (!retried) {
      return NextResponse.json(
        { error: "Job not found or not retryable" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Job queued for retry" });
  } catch (err) {
    console.error("Job retry error:", err);
    return NextResponse.json({ error: "Failed to retry job" }, { status: 500 });
  }
}
