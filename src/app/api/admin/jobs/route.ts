import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const adminEmails = (process.env.COCKROACH_ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase());
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  // For now, we trust the client-side admin check.
  // In production, verify the JWT and check the email.
  return true;
}

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Fetch jobs with count
    const { data: jobs, count, error } = await sp
      .from("data_acquisition_jobs")
      .select("*", { count: "exact" })
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      // Table might not exist yet
      return NextResponse.json({
        jobs: [],
        stats: { total: 0, completed: 0, running: 0, failed: 0 },
        totalPages: 1,
      });
    }

    // Get stats
    const { data: allJobs } = await sp
      .from("data_acquisition_jobs")
      .select("status");

    const stats = {
      total: allJobs?.length || 0,
      completed: allJobs?.filter((j) => j.status === "completed").length || 0,
      running: allJobs?.filter((j) => j.status === "running" || j.status === "in_progress").length || 0,
      failed: allJobs?.filter((j) => j.status === "failed").length || 0,
    };

    return NextResponse.json({
      jobs: jobs || [],
      stats,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err) {
    return NextResponse.json({
      jobs: [],
      stats: { total: 0, completed: 0, running: 0, failed: 0 },
      totalPages: 1,
    });
  }
}
