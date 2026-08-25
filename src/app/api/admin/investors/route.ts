import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "0");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const search = url.searchParams.get("search") || "";
    const type = url.searchParams.get("type") || "";

    const from = page * limit;
    const to = from + limit - 1;

    let query = sp
      .from("investors")
      .select(
        "id, full_name, company_name, investor_type, email, fit_score, investment_sectors, investment_stages, location, source, created_at",
        { count: "exact" }
      );

    // Apply search filter
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    // Apply type filter
    if (type) {
      query = query.eq("investor_type", type);
    }

    // Order by fit_score descending, then created_at
    query = query
      .order("fit_score", { ascending: false, nullsFirst: false })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      investors: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (err) {
    console.error("Admin investors API error:", err);
    return NextResponse.json(
      { error: "Failed to load investors" },
      { status: 500 }
    );
  }
}
