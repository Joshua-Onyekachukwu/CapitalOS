// =============================================
// Investors Facets API Route (Supabase)
// =============================================
// Returns available filter values with counts for the search UI.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const sp = request.nextUrl.searchParams;

    // Fetch a large sample for facet computation
    const { data: investors, count: total } = await supabase
      .from("investors")
      .select("investor_type, investment_sectors, investment_stages, country, city, outreach_readiness, is_verified, fit_score, data_quality_score, email, linkedin_url")
      .limit(5000);

    const rows = investors || [];

    // Compute facets
    const typeCounts: Record<string, number> = {};
    const sectorCounts: Record<string, number> = {};
    const stageCounts: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};
    const readinessCounts: Record<string, number> = {};
    let withEmail = 0, withoutEmail = 0;
    let withLinkedin = 0, withoutLinkedin = 0;
    let verifiedYes = 0, verifiedNo = 0;

    for (const inv of rows) {
      // Type
      if (inv.investor_type) {
        typeCounts[inv.investor_type] = (typeCounts[inv.investor_type] || 0) + 1;
      }
      // Sectors
      if (Array.isArray(inv.investment_sectors)) {
        for (const s of inv.investment_sectors) {
          if (s) sectorCounts[s] = (sectorCounts[s] || 0) + 1;
        }
      }
      // Stages
      if (Array.isArray(inv.investment_stages)) {
        for (const s of inv.investment_stages) {
          if (s) stageCounts[s] = (stageCounts[s] || 0) + 1;
        }
      }
      // Country
      if (inv.country) {
        countryCounts[inv.country] = (countryCounts[inv.country] || 0) + 1;
      }
      // Readiness
      if (inv.outreach_readiness) {
        readinessCounts[inv.outreach_readiness] = (readinessCounts[inv.outreach_readiness] || 0) + 1;
      }
      // Email
      if (inv.email && inv.email.trim()) withEmail++; else withoutEmail++;
      // LinkedIn
      if (inv.linkedin_url && inv.linkedin_url.trim()) withLinkedin++; else withoutLinkedin++;
      // Verified
      if (inv.is_verified) verifiedYes++; else verifiedNo++;
    }

    // Sort and format
    const sortDesc = (obj: Record<string, number>) =>
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count }));

    return NextResponse.json({
      total: total || rows.length,
      types: sortDesc(typeCounts),
      sectors: sortDesc(sectorCounts),
      stages: sortDesc(stageCounts),
      countries: sortDesc(countryCounts),
      readiness: sortDesc(readinessCounts),
      emailStats: { with: withEmail, without: withoutEmail },
      linkedinStats: { with: withLinkedin, without: withoutLinkedin },
      verifiedStats: { yes: verifiedYes, no: verifiedNo },
    });
  } catch (err) {
    console.error("Facets API error:", err);
    return NextResponse.json({ error: "Failed to load facets" }, { status: 500 });
  }
}
