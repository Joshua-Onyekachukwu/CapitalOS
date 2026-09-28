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
    const search = sp.get("search") || sp.get("query") || "";
    const type = sp.get("type") || "";
    const country = sp.get("country") || "";
    const city = sp.get("city") || "";
    const readiness = sp.get("readiness") || "";
    const verified = sp.get("verified") || "";
    const minScore = sp.get("minScore") || sp.get("minFitScore") || "";
    const maxScore = sp.get("maxScore") || "";
    const hasEmail = sp.get("hasEmail") || "";
    const hasLinkedin = sp.get("hasLinkedin") || "";
    const minQuality = sp.get("minQuality") || "";
    const firmId = sp.get("firmId") || "";
    const stage = sp.get("stage") || "";        // single stage value
    const sector = sp.get("sector") || "";      // single sector value
    // Array params — "sectors" and "stages" can be comma-separated or multiple values
    const sectorsParam = sp.get("sectors") || "";
    const stagesParam = sp.get("stages") || "";
    const sectors = sectorsParam ? sectorsParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const stages = stagesParam ? stagesParam.split(",").map((s) => s.trim()).filter(Boolean) : [];

    // ── Sorting ──
    const validSorts = ["created_at", "fit_score", "full_name", "data_quality_score", "portfolio_count"];
    const sortBy = validSorts.includes(sp.get("sortBy") || "") ? sp.get("sortBy")! : "created_at";
    const sortDir = sp.get("sortDir") === "asc" || sp.get("sortDirection") === "asc";

    // Use service role key (bypasses RLS for public investor data)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Helper to apply common filters
    const applyFilters = (q: any) => {
      // Merged/deactivated records (duplicate merges set is_active=false) must
      // never surface to users — they exist only as merge-history evidence.
      q = q.eq("is_active", true);
      // NOTE: only columns that actually exist on `investors` — referencing a
      // phantom column (e.g. firm_name) makes PostgREST reject the whole .or()
      // with 42703, which surfaced as "0 results for every search". Firm search
      // would need an embedded-resource query on investor_firms; this dataset
      // has no firm names on investor rows (current_firm_id is null).
      // Commas/parens are stripped: they would break the .or() list syntax.
      if (search) {
        const safe = search.replace(/[,()]/g, " ").trim();
        if (safe) {
          q = q.or(
            `full_name.ilike.%${safe}%,email.ilike.%${safe}%,job_title.ilike.%${safe}%,bio.ilike.%${safe}%`
          );
        }
      }
      if (type) q = q.eq("investor_type", type);
      if (country) q = q.ilike("country", `%${country}%`);
      if (city) q = q.ilike("city", `%${city}%`);
      if (readiness) q = q.eq("outreach_readiness", readiness);
      if (verified === "true") q = q.eq("is_verified", true);
      if (minScore) q = q.gte("fit_score", parseInt(minScore));
      if (minQuality) q = q.gte("data_quality_score", parseInt(minQuality));
      if (hasEmail === "true") q = q.not("email", "is", null).neq("email", "");
      if (hasLinkedin === "true") q = q.not("linkedin_url", "is", null).neq("linkedin_url", "");
      if (firmId) q = q.eq("current_firm_id", firmId);
      // Single stage/sector values (from main investor list filters)
      if (stage) q = q.contains("investment_stages", [stage]);
      if (sector) q = q.contains("investment_sectors", [sector]);
      // Array overlap — any of the specified values must be in the array columns
      if (stages.length > 0) q = q.overlaps("investment_stages", stages);
      if (sectors.length > 0) q = q.overlaps("investment_sectors", sectors);
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
    if (countResult.error) {
      // A failed count previously fell through as `undefined` → UI showed a
      // misleading "0 total". Fail loudly instead.
      console.error("Supabase count query error:", countResult.error);
      return NextResponse.json({ error: "Failed to count investors" }, { status: 500 });
    }
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
