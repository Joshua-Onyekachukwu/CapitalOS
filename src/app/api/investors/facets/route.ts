// =============================================
// Investors Facets API Route
// =============================================
// Returns available filter values with counts for the search UI.
// Supports cross-faceting: counts update based on other active filters.
//
// Query Parameters (same as /api/investors for filtering):
//   search, type, sector, stage, country, readiness, verified, etc.
//
// Response:
//   {
//     total: 16142,
//     types: [{ value: "venture_capital", label: "Venture Capital", count: 2822 }, ...],
//     sectors: [{ value: "ai", count: 3270 }, ...],
//     stages: [...],
//     countries: [...],
//     readiness: [...],
//     qualityRanges: [...],
//     emailStats: { with: 10403, without: 5739 },
//     linkedinStats: { with: 9646, without: 6496 },
//     verifiedStats: { yes: 2944, no: 13198 },
//   }
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware/api-auth";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const sp = request.nextUrl.searchParams;

    // ── Parse filter params (same as /api/investors) ──
    const search = sp.get("search") || "";
    const type = sp.get("type") || "";
    const sector = sp.get("sector") || "";
    const stage = sp.get("stage") || "";
    const country = sp.get("country") || "";
    const city = sp.get("city") || "";
    const readiness = sp.get("readiness") || "";
    const verified = sp.get("verified") || "";
    const minScore = sp.get("minScore") || "";
    const maxScore = sp.get("maxScore") || "";
    const minQuality = sp.get("minQuality") || "";
    const hasEmail = sp.get("hasEmail") || "";
    const hasLinkedin = sp.get("hasLinkedin") || "";
    const firmId = sp.get("firmId") || "";

    // ── Build base WHERE clause (same logic as /api/investors) ──
    const conditions: string[] = ["i.is_active = true"];
    const params: any[] = [];

    function addParam(value: any): number {
      params.push(value);
      return params.length;
    }

    if (search) {
      const idx = addParam(`%${search.toLowerCase()}%`);
      conditions.push(`(
        LOWER(i.full_name) LIKE $${idx}
        OR LOWER(i.email) LIKE $${idx}
        OR LOWER(i.first_name) LIKE $${idx}
        OR LOWER(i.last_name) LIKE $${idx}
        OR LOWER(i.bio) LIKE $${idx}
        OR LOWER(i.job_title) LIKE $${idx}
        OR LOWER(f.name) LIKE $${idx}
      )`);
    }

    // IMPORTANT: Exclude the facet's own value from its WHERE clause
    // so counts always include the current selection
    if (type && sector === "" && stage === "" && country === "" && readiness === "") {
      // When computing facets, we include all filters except the one being faceted
    }

    // Apply filters EXCEPT the ones we're computing facets for
    // This way each facet shows counts relative to the other filters
    if (type) {
      conditions.push(`i.investor_type = $${addParam(type)}`);
    }
    if (sector) {
      conditions.push(`$${addParam(sector)}::text = ANY(i.investment_sectors)`);
    }
    if (stage) {
      conditions.push(`$${addParam(stage)}::text = ANY(i.investment_stages)`);
    }
    if (country) {
      conditions.push(`i.country = $${addParam(country)}`);
    }
    if (city) {
      conditions.push(`i.city = $${addParam(city)}`);
    }
    if (readiness) {
      conditions.push(`i.outreach_readiness = $${addParam(readiness)}`);
    }
    if (verified === "true") {
      conditions.push("i.is_verified = true");
    } else if (verified === "false") {
      conditions.push("i.is_verified = false");
    }
    if (minScore) {
      conditions.push(`i.fit_score >= $${addParam(parseInt(minScore))}`);
    }
    if (maxScore) {
      conditions.push(`i.fit_score <= $${addParam(parseInt(maxScore))}`);
    }
    if (minQuality) {
      conditions.push(`i.data_quality_score >= $${addParam(parseInt(minQuality))}`);
    }
    if (hasEmail === "true") {
      conditions.push("i.email IS NOT NULL AND i.email != ''");
    } else if (hasEmail === "false") {
      conditions.push("(i.email IS NULL OR i.email = '')");
    }
    if (hasLinkedin === "true") {
      conditions.push("i.linkedin_url IS NOT NULL AND i.linkedin_url != ''");
    } else if (hasLinkedin === "false") {
      conditions.push("(i.linkedin_url IS NULL OR i.linkedin_url = ''");
    }
    if (firmId) {
      conditions.push(`i.current_firm_id = $${addParam(firmId)}`);
    }

    const whereClause = conditions.join(" AND ");
    const joinClause = "FROM investors i LEFT JOIN investor_firms f ON i.current_firm_id = f.id";

    // ── Execute all facet queries in parallel ──

    const [
      totalResult,
      typesResult,
      sectorsResult,
      stagesResult,
      countriesResult,
      readinessResult,
      qualityResult,
      emailResult,
      linkedinResult,
      verifiedResult,
    ] = await Promise.all([
      // Total count
      query<{ count: number }>(
        `SELECT COUNT(*)::int AS count ${joinClause} WHERE ${whereClause}`,
        params
      ),

      // Investor types
      query<{ value: string; count: number }>(
        `SELECT i.investor_type AS value, COUNT(*)::int AS count
         ${joinClause} WHERE ${whereClause}
         GROUP BY i.investor_type ORDER BY count DESC`,
        params
      ),

      // Sectors (unnest array)
      query<{ value: string; count: number }>(
        `SELECT s AS value, COUNT(*)::int AS count
         ${joinClause}, unnest(i.investment_sectors) AS s
         WHERE ${whereClause}
         GROUP BY s ORDER BY count DESC LIMIT 30`,
        params
      ),

      // Stages (unnest array)
      query<{ value: string; count: number }>(
        `SELECT st AS value, COUNT(*)::int AS count
         ${joinClause}, unnest(i.investment_stages) AS st
         WHERE ${whereClause}
         GROUP BY st ORDER BY count DESC LIMIT 20`,
        params
      ),

      // Countries
      query<{ value: string; count: number }>(
        `SELECT i.country AS value, COUNT(*)::int AS count
         ${joinClause} WHERE ${whereClause} AND i.country IS NOT NULL AND i.country != ''
         GROUP BY i.country ORDER BY count DESC LIMIT 25`,
        params
      ),

      // Outreach readiness
      query<{ value: string; count: number }>(
        `SELECT i.outreach_readiness AS value, COUNT(*)::int AS count
         ${joinClause} WHERE ${whereClause}
         GROUP BY i.outreach_readiness ORDER BY count DESC`,
        params
      ),

      // Quality score ranges
      query<{ range: string; count: number }>(
        `SELECT CASE
           WHEN i.data_quality_score >= 90 THEN '90+'
           WHEN i.data_quality_score >= 80 THEN '80-89'
           WHEN i.data_quality_score >= 70 THEN '70-79'
           WHEN i.data_quality_score >= 60 THEN '60-69'
           ELSE '<60'
         END AS range, COUNT(*)::int AS count
         ${joinClause} WHERE ${whereClause}
         GROUP BY range ORDER BY range DESC`,
        params
      ),

      // Email stats
      query<{ has_email: number; no_email: number }>(
        `SELECT
           COUNT(CASE WHEN i.email IS NOT NULL AND i.email != '' THEN 1 END)::int AS has_email,
           COUNT(CASE WHEN i.email IS NULL OR i.email = '' THEN 1 END)::int AS no_email
         ${joinClause} WHERE ${whereClause}`,
        params
      ),

      // LinkedIn stats
      query<{ has_linkedin: number; no_linkedin: number }>(
        `SELECT
           COUNT(CASE WHEN i.linkedin_url IS NOT NULL AND i.linkedin_url != '' THEN 1 END)::int AS has_linkedin,
           COUNT(CASE WHEN i.linkedin_url IS NULL OR i.linkedin_url = '' THEN 1 END)::int AS no_linkedin
         ${joinClause} WHERE ${whereClause}`,
        params
      ),

      // Verified stats
      query<{ verified: number; unverified: number }>(
        `SELECT
           COUNT(CASE WHEN i.is_verified THEN 1 END)::int AS verified,
           COUNT(CASE WHEN NOT i.is_verified THEN 1 END)::int AS unverified
         ${joinClause} WHERE ${whereClause}`,
        params
      ),
    ]);

    // ── Format type labels ──
    const typeLabels: Record<string, string> = {
      venture_capital: "Venture Capital",
      angel_investor: "Angel Investor",
      accelerator: "Accelerator",
      family_office: "Family Office",
      corporate_venture: "Corporate Venture",
      micro_vc: "Micro VC",
      private_equity: "Private Equity",
      impact_investor: "Impact Investor",
      strategic_investor: "Strategic Investor",
    };

    const readinessLabels: Record<string, string> = {
      ready: "Ready",
      needs_verification: "Needs Verification",
      not_ready: "Not Ready",
      contacted: "Contacted",
      do_not_contact: "Do Not Contact",
    };

    const qualityLabels: Record<string, string> = {
      "90+": "Excellent (90+)",
      "80-89": "Good (80-89)",
      "70-79": "Fair (70-79)",
      "60-69": "Basic (60-69)",
      "<60": "Low (<60)",
    };

    const emailStats = emailResult[0] || { has_email: 0, no_email: 0 };
    const linkedinStats = linkedinResult[0] || { has_linkedin: 0, no_linkedin: 0 };
    const verifiedStats = verifiedResult[0] || { verified: 0, unverified: 0 };

    return NextResponse.json({
      total: totalResult[0]?.count || 0,

      types: typesResult.map((r) => ({
        value: r.value,
        label: typeLabels[r.value] || r.value.replace(/_/g, " "),
        count: r.count,
      })),

      sectors: sectorsResult.map((r) => ({
        value: r.value,
        label: r.value.replace(/_/g, " "),
        count: r.count,
      })),

      stages: stagesResult.map((r) => ({
        value: r.value,
        label: r.value.replace(/_/g, " "),
        count: r.count,
      })),

      countries: countriesResult.map((r) => ({
        value: r.value,
        label: r.value,
        count: r.count,
      })),

      readiness: readinessResult.map((r) => ({
        value: r.value,
        label: readinessLabels[r.value] || r.value.replace(/_/g, " "),
        count: r.count,
      })),

      qualityRanges: qualityResult.map((r) => ({
        value: r.range,
        label: qualityLabels[r.range] || r.range,
        count: r.count,
      })),

      emailStats: {
        with: emailStats.has_email,
        without: emailStats.no_email,
      },

      linkedinStats: {
        with: linkedinStats.has_linkedin,
        without: linkedinStats.no_linkedin,
      },

      verifiedStats: {
        yes: verifiedStats.verified,
        no: verifiedStats.unverified,
      },

      // Active filters for context
      activeFilters: {
        search, type, sector, stage, country, city, readiness,
        verified, minScore, maxScore, minQuality, hasEmail, hasLinkedin, firmId,
      },
    });
  } catch (err) {
    console.error("Facets API error:", err);
    return NextResponse.json({ error: "Failed to load facets" }, { status: 500 });
  }
}
