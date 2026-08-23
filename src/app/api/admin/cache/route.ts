import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { cache } from "@/lib/cache";

// =============================================
// Cache Metrics & Management API
// =============================================
// GET  /api/admin/cache — View cache metrics
// POST /api/admin/cache — Invalidate caches
//   { "action": "clear" } — Clear all caches
//   { "action": "invalidate", "prefix": "facets" } — Invalidate by prefix

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  const metrics = cache.getMetrics();

  return NextResponse.json({
    metrics,
    ttlConfig: {
      facets: "60s",
      cockpit: "30s",
      search: "15s",
      metadata: "300s",
      campaigns: "30s",
    },
    description: "In-memory cache with TTL + LRU eviction. Max 500 entries.",
  });
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { action, prefix } = body;

    if (action === "clear") {
      cache.clear();
      return NextResponse.json({ success: true, message: "All caches cleared" });
    }

    if (action === "invalidate" && prefix) {
      const count = cache.invalidatePrefix(prefix);
      return NextResponse.json({
        success: true,
        message: `Invalidated ${count} entries with prefix "${prefix}"`,
        count,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use: clear or invalidate with prefix" },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
