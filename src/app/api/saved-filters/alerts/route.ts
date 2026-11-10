// =============================================
// Saved-search alerts API
// =============================================
// GET   → this user's alerts + unread count
// POST  → evaluate every saved filter now (throttled; ?force=1 bypasses)
// PATCH → mark one alert or all of them read

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { evaluateSavedFilters, listAlerts } from "@/lib/services/investors/alerts";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const alerts = await listAlerts(user.id);
    return NextResponse.json(
      {
        alerts,
        unreadCount: alerts.filter((a) => !a.readAt).length,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("[search-alerts] list failed:", err);
    return NextResponse.json({ error: "Failed to load alerts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
    const result = await evaluateSavedFilters(user.id, { force });
    const alerts = await listAlerts(user.id);
    return NextResponse.json(
      {
        ...result,
        alerts,
        unreadCount: alerts.filter((a) => !a.readAt).length,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("[search-alerts] check failed:", err);
    return NextResponse.json({ error: "Failed to check for new matches" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id : null;
    const sp = getServiceClient();

    let query = sp
      .from("search_alerts")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (id) query = query.eq("id", id);

    const { error } = await query;
    if (error) throw error;

    const alerts = await listAlerts(user.id);
    return NextResponse.json({
      alerts,
      unreadCount: alerts.filter((a) => !a.readAt).length,
    });
  } catch (err) {
    console.error("[search-alerts] mark read failed:", err);
    return NextResponse.json({ error: "Failed to update alerts" }, { status: 500 });
  }
}
