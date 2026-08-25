import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { createClient } from "@supabase/supabase-js";

// =============================================
// Saved Filters API Route (Supabase)
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

    const pageName = request.nextUrl.searchParams.get("page") || "investors";

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: rows, error } = await sp
      .from("saved_filters")
      .select("id, name, filter_key, filters, sort_by, page_name, created_at")
      .eq("user_id", user.id)
      .eq("page_name", pageName)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      savedFilters: (rows || []).map((r) => ({
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
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { validateBodyAsync, savedFilterSchema } = await import("@/lib/validate");
    const validated = await validateBodyAsync(request, savedFilterSchema);
    if (validated instanceof NextResponse) return validated;

    const { name, filters, sortBy, pageName } = validated;
    const filterKey = JSON.stringify(filters);

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await sp
      .from("saved_filters")
      .upsert(
        {
          user_id: user.id,
          name,
          filter_key: filterKey,
          filters: JSON.stringify(filters),
          sort_by: sortBy || "created_at",
          page_name: pageName,
        },
        { onConflict: "user_id,filter_key,page_name" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      savedFilter: {
        id: data.id,
        name: data.name,
        filterKey: data.filter_key,
        filters: data.filters,
        sortBy: data.sort_by,
        pageName: data.page_name,
        createdAt: data.created_at,
      },
    });
  } catch (err) {
    console.error("Saved filters POST error:", err);
    return NextResponse.json({ error: "Failed to save filter" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Filter ID is required" }, { status: 400 });
    }

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await sp
      .from("saved_filters")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Saved filters DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete filter" }, { status: 500 });
  }
}
