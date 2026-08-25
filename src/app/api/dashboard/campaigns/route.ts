import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { createClient } from "@supabase/supabase-js";

// =============================================
// Campaigns API — Supabase
// =============================================

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const spParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(spParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(spParams.get("limit") || "50")));
    const search = spParams.get("search") || "";
    const status = spParams.get("status") || "";

    // Try fetching from data_acquisition_jobs (may not exist in Supabase)
    let campaigns: any[] = [];
    let total = 0;

    try {
      let query = sp.from("data_acquisition_jobs").select("*", { count: "exact" });
      query = query.eq("created_by", user.id);

      if (status) {
        query = query.eq("status", status);
      }

      // Order and paginate
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.order("created_at", { ascending: false }).range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;
      campaigns = data || [];
      total = count || 0;
    } catch {
      // Table doesn't exist — return empty
      campaigns = [];
      total = 0;
    }

    const mapped = campaigns.map((row) => ({
      id: row.id,
      name: row.filters?.name || "Untitled Campaign",
      description: row.filters?.description || "",
      status: row.status === "pending" ? "draft" : row.status === "running" ? "active" : row.status === "completed" ? "completed" : "paused",
      investor_count: row.found_count || 0,
      emails_sent: row.processed_count || 0,
      responses: row.validated_count || 0,
      credits_used: row.credits_used || 0,
      created_at: row.created_at,
      completed_at: row.completed_at,
      user_id: row.created_by,
      sector: row.filters?.sector || null,
      stage: row.filters?.stage || null,
      error_message: row.error_message || null,
    }));

    return NextResponse.json({
      campaigns: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      filters: { search, status, sortBy: "created_at", sortDir: "desc" },
      facets: { status: {}, sector: {}, stage: {} },
    });
  } catch (err) {
    console.error("Campaigns API error:", err);
    return NextResponse.json({ error: "Failed to load campaigns" }, { status: 500 });
  }
}
