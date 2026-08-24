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

    // ── Count query (use select with no range to get total) ──
    let countQ = supabase
      .from("investors")
      .select("id", { count: "exact" });

    if (search) countQ = countQ.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,job_title.ilike.%${search}%`);
    if (type) countQ = countQ.eq("investor_type", type);
    if (country) countQ = countQ.eq("country", country);
    if (readiness) countQ = countQ.eq("outreach_readiness", readiness);
    if (verified === "true") countQ = countQ.eq("is_verified", true);
    if (minScore) countQ = countQ.gte("fit_score", parseInt(minScore));
    if (hasEmail === "true") countQ = countQ.not("email", "is", null).neq("email", "");
    countQ = countQ.limit(0);

    const { count } = await countQ;

    // ── Data query ──
    let dataQ = supabase
      .from("investors")
      .select("*");

    if (search) dataQ = dataQ.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,job_title.ilike.%${search}%`);
    if (type) dataQ = dataQ.eq("investor_type", type);
    if (country) dataQ = dataQ.eq("country", country);
    if (readiness) dataQ = dataQ.eq("outreach_readiness", readiness);
    if (verified === "true") dataQ = dataQ.eq("is_verified", true);
    if (minScore) dataQ = dataQ.gte("fit_score", parseInt(minScore));
    if (hasEmail === "true") dataQ = dataQ.not("email", "is", null).neq("email", "");

    dataQ = dataQ.order(sortBy, { ascending: sortDir, nullsFirst: false });
    dataQ = dataQ.range(offset, offset + limit - 1);

    const { data: investors, error } = await dataQ;

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
