import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// =============================================
// Saved Filters API Route
// =============================================
// GET    /api/saved-filters?page=investors     — List saved filters for a page
// POST   /api/saved-filters                     — Save a new filter
// DELETE /api/saved-filters?id=xxx              — Delete a saved filter
// =============================================

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pageName = request.nextUrl.searchParams.get("page") || "investors";

    const rows = await query<any>(
      `SELECT id, name, filter_key, filters, sort_by, page_name, created_at
       FROM saved_filters
       WHERE user_id = $1 AND page_name = $2
       ORDER BY created_at DESC`,
      [user.id, pageName]
    );

    return NextResponse.json({
      savedFilters: rows.map((r) => ({
        id: r.id,
        name: r.name,
        filterKey: r.filter_key,
        filters: r.filters,
        sortBy: r.sort_by,
        pageName: r.page_name,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error("Saved filters GET error:", err);
    return NextResponse.json({ error: "Failed to load saved filters" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, filters, sortBy, pageName = "investors" } = body;

    if (!name || !filters) {
      return NextResponse.json({ error: "Name and filters are required" }, { status: 400 });
    }

    // Generate a stable key from the filters for dedup
    const filterKey = JSON.stringify(filters);

    // Upsert: if same filters already saved, update the name
    const rows = await query<any>(
      `INSERT INTO saved_filters (user_id, name, filter_key, filters, sort_by, page_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, filter_key, page_name)
       DO UPDATE SET name = $2, updated_at = NOW()
       RETURNING id, name, filter_key, filters, sort_by, page_name, created_at`,
      [user.id, name, filterKey, JSON.stringify(filters), sortBy || "created_at", pageName]
    );

    return NextResponse.json({
      savedFilter: {
        id: rows[0].id,
        name: rows[0].name,
        filterKey: rows[0].filter_key,
        filters: rows[0].filters,
        sortBy: rows[0].sort_by,
        pageName: rows[0].page_name,
        createdAt: rows[0].created_at,
      },
    });
  } catch (err) {
    console.error("Saved filters POST error:", err);
    return NextResponse.json({ error: "Failed to save filter" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Filter ID is required" }, { status: 400 });
    }

    await query(
      "DELETE FROM saved_filters WHERE id = $1 AND user_id = $2",
      [id, user.id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Saved filters DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete filter" }, { status: 500 });
  }
}
