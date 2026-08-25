// =============================================
// Admin Dashboard API Route (Supabase) — Cached
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// ── In-memory cache (resets on server restart) ──
let cachedStats: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(_request: NextRequest) {
  const user = await requireAuth(_request);
  if (user instanceof NextResponse) return user;

  try {
    // Return cached stats if fresh
    if (cachedStats && Date.now() - cacheTimestamp < CACHE_TTL) {
      return NextResponse.json(cachedStats);
    }

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── 5 parallel count queries (all use head:true = no data transfer, just counts) ──
    const [totalR, emailR, linkedinR, verifiedR, fitR] = await Promise.all([
      sp.from("investors").select("id", { count: "exact", head: true }),
      sp.from("investors").select("id", { count: "exact", head: true }).not("email", "is", null),
      sp.from("investors").select("id", { count: "exact", head: true }).not("linkedin_url", "is", null),
      sp.from("investors").select("id", { count: "exact", head: true }).eq("is_verified", true),
      sp.from("investors").select("id", { count: "exact", head: true }).gte("fit_score", 80),
    ]);

    // ── Quick sample for type breakdown (only 1000 rows) ──
    const { data: sample } = await sp
      .from("investors")
      .select("investor_type")
      .limit(1000);

    const typeCounts: Record<string, number> = {};
    const typeSampleTotal = sample?.length || 1;
    sample?.forEach((i) => {
      const t = i.investor_type || "unknown";
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    // Estimate full type counts from sample proportions
    const total = totalR.count || 0;
    const estimatedTypeCounts: Record<string, number> = {};
    for (const [type, count] of Object.entries(typeCounts)) {
      estimatedTypeCounts[type] = Math.round((count / typeSampleTotal) * total);
    }

    const stats = {
      dataHealth: {
        total_investors: total,
        with_email: emailR.count || 0,
        with_linkedin: linkedinR.count || 0,
        verified: verifiedR.count || 0,
        high_quality: 0, // Skip — column rarely populated
        high_fit: fitR.count || 0,
        pending_duplicates: 0,
        recent_additions: 0,
      },
      typeCounts: estimatedTypeCounts,
      recentJobs: [],
      _cached: true,
      _cacheAge: 0,
    };

    // Update cache
    cachedStats = stats;
    cacheTimestamp = Date.now();

    return NextResponse.json(stats);
  } catch (err) {
    console.error("Admin dashboard error:", err);
    return NextResponse.json(
      { error: "Failed to load admin data" },
      { status: 500 }
    );
  }
}
