// =============================================
// Investors List API Route (Supabase)
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const sp = request.nextUrl.searchParams;

    // ── Pagination ──
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "25")));
    const offset = (page - 1) * limit;

    // ── Filters ──
    const search = sp.get("search") || "";
    const type = sp.get("type") || "";
    const country = sp.get("country") || "";
    const readiness = sp.get("readiness") || "";
    const verified = sp.get("verified") || "";
    const minScore = sp.get("minScore") || "";
    const maxScore = sp.get("maxScore") || "";
    const hasEmail = sp.get("hasEmail") || "";
    const hasLinkedin = sp.get("hasLinkedin") || "";

    // ── Sorting ──
    const validSorts = ["created_at", "fit_score", "full_name", "data_quality_score", "portfolio_count"];
    const sortBy = validSorts.includes(sp.get("sortBy") || "") ? sp.get("sortBy")! : "created_at";
    const sortDir = sp.get("sortDir") === "asc";

    // Use service role key (bypasses RLS for public investor data)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Helper to apply common filters
    const applyFilters = (q: any) => {
      if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,job_title.ilike.%${search}%`);
      if (type) q = q.eq("investor_type", type);
      if (country) q = q.eq("country", country);
      if (readiness) q = q.eq("outreach_readiness", readiness);
      if (verified === "true") q = q.eq("is_verified", true);
      if (minScore) q = q.gte("fit_score", parseInt(minScore));
      if (hasEmail === "true") q = q.not("email", "is", null).neq("email", "");
      return q;
    };

    // Run count and data queries in parallel
    const [countResult, dataResult] = await Promise.all([
      // Count query
      applyFilters(
        supabase.from("investors").select("id", { count: "exact", head: true })
      ),
      // Data query
      applyFilters(
        supabase.from("investors")
          .select("*")
          .order(sortBy, { ascending: sortDir, nullsFirst: false })
          .range(offset, offset + limit - 1)
      ),
    ]);

    const { count } = countResult;
    const { data: investors, error } = dataResult;

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json({ error: "Failed to load investors" }, { status: 500 });
    }

    return NextResponse.json({
      investors: investors || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err) {
    console.error("Investors list error:", err);
    return NextResponse.json({ error: "Failed to load investors" }, { status: 500 });
  }
}
