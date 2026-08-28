// =============================================
// Investors Facets API Route (Supabase)
// =============================================
// Returns available filter values with counts for the search UI.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";
import { cache, userCacheKey, CACHE_TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    // Check cache first (facets change infrequently)
    const cacheKey = userCacheKey(user.id, "facets");
    const cached = await cache.getOrSet(
      cacheKey,
      () => computeFacets(),
      { ttlMs: CACHE_TTL.medium }
    );
    return NextResponse.json(cached);
  } catch (err) {
    console.error("Facets error:", err);
    return NextResponse.json({ error: "Failed to load facets" }, { status: 500 });
  }
}

async function computeFacets() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Get accurate counts for key stats using head:true (fast, no data transfer)
  const [
    { count: totalCount },
    { count: withEmailCount },
    { count: withLinkedinCount },
    { count: verifiedCount },
    { count: readyCount },
    { count: needsVerificationCount },
  ] = await Promise.all([
    supabase.from("investors").select("*", { count: "exact", head: true }),
    supabase.from("investors").select("*", { count: "exact", head: true }).not("email", "is", null).neq("email", ""),
    supabase.from("investors").select("*", { count: "exact", head: true }).not("linkedin_url", "is", null).neq("linkedin_url", ""),
    supabase.from("investors").select("*", { count: "exact", head: true }).eq("is_verified", true),
    supabase.from("investors").select("*", { count: "exact", head: true }).eq("outreach_readiness", "ready"),
    supabase.from("investors").select("*", { count: "exact", head: true }).eq("outreach_readiness", "needs_verification"),
  ]);

  // 2. Fetch a larger sample for category facets (type, sector, stage, country)
  const SAMPLE_SIZE = 5000;
  const { data: investors } = await supabase
    .from("investors")
    .select("investor_type, investment_sectors, investment_stages, country, city, outreach_readiness")
    .limit(SAMPLE_SIZE);

  const rows = investors || [];

  // Compute category facets from sample
  const typeCounts: Record<string, number> = {};
  const sectorCounts: Record<string, number> = {};
  const stageCounts: Record<string, number> = {};
  const countryCounts: Record<string, number> = {};
  const readinessCounts: Record<string, number> = {};

  for (const inv of rows) {
    if (inv.investor_type) {
      typeCounts[inv.investor_type] = (typeCounts[inv.investor_type] || 0) + 1;
    }
    if (Array.isArray(inv.investment_sectors)) {
      for (const s of inv.investment_sectors) {
        if (s) sectorCounts[s] = (sectorCounts[s] || 0) + 1;
      }
    }
    if (Array.isArray(inv.investment_stages)) {
      for (const s of inv.investment_stages) {
        if (s) stageCounts[s] = (stageCounts[s] || 0) + 1;
      }
    }
    if (inv.country) {
      countryCounts[inv.country] = (countryCounts[inv.country] || 0) + 1;
    }
    if (inv.outreach_readiness) {
      readinessCounts[inv.outreach_readiness] = (readinessCounts[inv.outreach_readiness] || 0) + 1;
    }
  }

  // Sort and format
  const sortDesc = (obj: Record<string, number>) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }));

  return {
    total: totalCount || 0,
    types: sortDesc(typeCounts),
    sectors: sortDesc(sectorCounts),
    stages: sortDesc(stageCounts),
    countries: sortDesc(countryCounts),
    readiness: sortDesc(readinessCounts),
    emailStats: {
      with: withEmailCount || 0,
      without: (totalCount || 0) - (withEmailCount || 0),
    },
    linkedinStats: {
      with: withLinkedinCount || 0,
      without: (totalCount || 0) - (withLinkedinCount || 0),
    },
    verifiedStats: {
      yes: verifiedCount || 0,
      no: (totalCount || 0) - (verifiedCount || 0),
    },
    readyToOutreach: readyCount || 0,
    needsVerification: needsVerificationCount || 0,
    _sampleSize: rows.length,
    _sampleTotal: totalCount || 0,
  };
}
