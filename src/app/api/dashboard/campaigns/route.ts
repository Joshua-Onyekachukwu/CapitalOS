import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// =============================================
// Campaigns API — Enhanced with Search & Filters
// =============================================
// Query Parameters:
//   search   — free-text (name, description, sector, stage)
//   status   — draft/active/paused/completed
//   sector   — filter by sector in filters JSON
//   stage    — filter by stage in filters JSON
//   sortBy   — created_at/name/investor_count/emails_sent (default: created_at)
//   sortDir  — asc/desc (default: desc)
//   page     — page number (default 1)
//   limit    — per page (default 50, max 100)
// =============================================

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;

    // ── Pagination ──
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "50")));
    const offset = (page - 1) * limit;

    // ── Filters ──
    const search = sp.get("search") || "";
    const status = sp.get("status") || "";
    const sector = sp.get("sector") || "";
    const stage = sp.get("stage") || "";

    // ── Sorting ──
    const validSorts = ["created_at", "found_count", "processed_count", "validated_count", "credits_used"];
    const sortBy = validSorts.includes(sp.get("sortBy") || "") ? sp.get("sortBy")! : "created_at";
    const sortDir = sp.get("sortDir") === "asc" ? "ASC" : "DESC";

    // ── Build WHERE clause ──
    const conditions: string[] = ["d.created_by = $1"];
    const params: any[] = [user.id];

    function addParam(value: any): number {
      params.push(value);
      return params.length;
    }

    // Search: name, description, sector, stage from filters JSONB
    if (search) {
      const idx = addParam(`%${search.toLowerCase()}%`);
      conditions.push(`(
        LOWER(COALESCE(d.filters->>'name', '')) LIKE $${idx}
        OR LOWER(COALESCE(d.filters->>'description', '')) LIKE $${idx}
        OR LOWER(COALESCE(d.filters->>'sector', '')) LIKE $${idx}
        OR LOWER(COALESCE(d.filters->>'stage', '')) LIKE $${idx}
      )`);
    }

    // Status filter
    if (status) {
      conditions.push(`d.status = $${addParam(status)}`);
    }

    // Sector filter (from JSONB filters)
    if (sector) {
      conditions.push(`LOWER(COALESCE(d.filters->>'sector', '')) = $${addParam(sector.toLowerCase())}`);
    }

    // Stage filter (from JSONB filters)
    if (stage) {
      conditions.push(`LOWER(COALESCE(d.filters->>'stage', '')) = $${addParam(stage.toLowerCase())}`);
    }

    const whereClause = conditions.join(" AND ");

    // ── Count total ──
    const countResult = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM data_acquisition_jobs d WHERE ${whereClause}`,
      params
    );
    const total = countResult[0]?.count || 0;

    // ── Fetch page ──
    // Map sortBy to actual column expression
    let orderBy: string;
    switch (sortBy) {
      case "found_count": orderBy = "d.found_count"; break;
      case "processed_count": orderBy = "d.processed_count"; break;
      case "validated_count": orderBy = "d.validated_count"; break;
      case "credits_used": orderBy = "d.credits_used"; break;
      default: orderBy = "d.created_at";
    }

    params.push(limit);
    params.push(offset);

    const rows = await query<any>(
      `SELECT d.* FROM data_acquisition_jobs d
       WHERE ${whereClause}
       ORDER BY ${orderBy} ${sortDir} NULLS LAST
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`,
      params
    );

    const campaigns = rows.map((row) => ({
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

    // ── Facet counts (for dropdown badges) ──
    // Count by status
    const statusFacets = await query<{ value: string; count: number }>(
      `SELECT COALESCE(d.status, 'pending') AS value, COUNT(*)::int AS count
       FROM data_acquisition_jobs d WHERE ${whereClause}
       GROUP BY d.status ORDER BY count DESC`,
      params.slice(0, -2) // Remove limit/offset params
    );

    // Count by sector (from JSONB)
    const sectorFacets = await query<{ value: string; count: number }>(
      `SELECT COALESCE(d.filters->>'sector', 'unknown') AS value, COUNT(*)::int AS count
       FROM data_acquisition_jobs d WHERE ${whereClause} AND d.filters->>'sector' IS NOT NULL
       GROUP BY d.filters->>'sector' ORDER BY count DESC`,
      params.slice(0, -2)
    );

    // Count by stage (from JSONB)
    const stageFacets = await query<{ value: string; count: number }>(
      `SELECT COALESCE(d.filters->>'stage', 'unknown') AS value, COUNT(*)::int AS count
       FROM data_acquisition_jobs d WHERE ${whereClause} AND d.filters->>'stage' IS NOT NULL
       GROUP BY d.filters->>'stage' ORDER BY count DESC`,
      params.slice(0, -2)
    );

    return NextResponse.json({
      campaigns,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      filters: { search, status, sector, stage, sortBy, sortDir },
      facets: {
        status: Object.fromEntries(statusFacets.map((r) => [r.value, r.count])),
        sector: Object.fromEntries(sectorFacets.map((r) => [r.value, r.count])),
        stage: Object.fromEntries(stageFacets.map((r) => [r.value, r.count])),
      },
    });
  } catch (err) {
    console.error("Campaigns API error:", err);
    return NextResponse.json({ error: "Failed to load campaigns" }, { status: 500 });
  }
}
