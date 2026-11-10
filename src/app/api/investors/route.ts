// =============================================
// Investors List API Route (Supabase)
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";
import { applyInvestorFilters, filtersFromRecord } from "@/lib/services/investors/query";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const sp = request.nextUrl.searchParams;

    // ── Pagination ──
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "25")));
    const offset = (page - 1) * limit;

    // Keyset cursor: base64url of { v: <sort value of last row>, id }. Offset
    // pagination scans every skipped row, which is linear at 500k; the cursor
    // walks the index instead. Clients that still send page/offset keep
    // working unchanged.
    const cursorParam = sp.get("cursor") || "";
    const skipCount = sp.get("skipCount") === "1";
    let cursor: { v: unknown; id: string } | null = null;
    if (cursorParam) {
      try {
        const decoded = JSON.parse(Buffer.from(cursorParam, "base64url").toString("utf8"));
        if (decoded && typeof decoded.id === "string") cursor = decoded;
      } catch {
        cursor = null; // an unreadable cursor degrades to first page, never a 500
      }
    }

    // ── Filters ──
    // Parsed into one shape and applied by the shared filter module, so this
    // endpoint, Discover and the saved-search alert matcher cannot drift.
    const filters = filtersFromRecord(Object.fromEntries(sp.entries()));

    // ── Sorting ──
    const validSorts = [
      "created_at",
      "fit_score",
      "full_name",
      "data_quality_score",
      "portfolio_count",
    ];
    const sortBy = validSorts.includes(sp.get("sortBy") || "") ? sp.get("sortBy")! : "created_at";
    const sortDir = sp.get("sortDir") === "asc" || sp.get("sortDirection") === "asc";

    // Use service role key (bypasses RLS for public investor data)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Helper to apply common filters
    const applyFilters = (q: any) => applyInvestorFilters(q, filters);

    // Run count and data queries in parallel. The count is skipped when the
    // caller passes skipCount=1, because an exact count over 500k filtered
    // rows costs more than the page itself.
    const [countResult, dataResult] = await Promise.all([
      skipCount
        ? Promise.resolve({ count: null as number | null, error: null })
        : applyFilters(supabase.from("investors").select("id", { count: "exact", head: true })),
      (() => {
        let q: any = applyFilters(supabase.from("investors").select("*"))
          .order(sortBy, { ascending: sortDir, nullsFirst: false })
          .order("id", { ascending: sortDir });
        if (cursor) {
          const op = sortDir ? "gt" : "lt";
          const v = encodeURIComponent(String(cursor.v));
          q = q.or(
            sortBy +
              "." +
              op +
              "." +
              v +
              ",and(" +
              sortBy +
              ".eq." +
              v +
              ",id." +
              op +
              "." +
              cursor.id +
              ")"
          );
        }
        return cursor ? q.limit(limit) : q.range(offset, offset + limit - 1);
      })(),
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

    const lastRow = (
      investors && investors.length > 0 ? investors[investors.length - 1] : null
    ) as Record<string, unknown> | null;
    const nextCursor = lastRow
      ? Buffer.from(JSON.stringify({ v: lastRow[sortBy], id: lastRow.id }), "utf8").toString(
          "base64url"
        )
      : null;

    return NextResponse.json({
      investors: investors || [],
      nextCursor,
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
