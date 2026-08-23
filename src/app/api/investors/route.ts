// =============================================
// Investors List API Route — Enhanced
// =============================================
// Query Parameters:
//   search       — free-text (name, email, bio, job title, firm)
//   type         — investor_type
//   sector       — investment_sectors contains this value
//   stage        — investment_stages contains this value
//   country      — country match
//   city         — city match
//   readiness    — outreach_readiness
//   verified     — is_verified (true/false)
//   minScore     — minimum fit_score
//   maxScore     — maximum fit_score
//   minQuality   — minimum data_quality_score
//   hasEmail     — with/without email (true/false)
//   hasLinkedin  — with/without LinkedIn (true/false)
//   firmId       — current_firm_id
//   minCheckSize — minimum min_check_size
//   maxCheckSize — minimum max_check_size
//   sortBy       — sort column
//   sortDir      — asc/desc
//   page         — page number (default 1)
//   limit        — per page (default 50, max 100)

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware/api-auth";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const sp = request.nextUrl.searchParams;

    // ── Pagination ──
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "50")));
    const offset = (page - 1) * limit;

    // ── Filters ──
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
    const minCheckSize = sp.get("minCheckSize") || "";
    const maxCheckSize = sp.get("maxCheckSize") || "";

    // ── Sorting ──
    const validSorts = ["created_at", "fit_score", "full_name", "data_quality_score", "portfolio_count"];
    const sortBy = validSorts.includes(sp.get("sortBy") || "") ? sp.get("sortBy")! : "created_at";
    const sortDir = sp.get("sortDir") === "asc" ? "ASC" : "DESC";

    // ── Build WHERE clause ──
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
      conditions.push("(i.linkedin_url IS NULL OR i.linkedin_url = '')");
    }

    if (firmId) {
      conditions.push(`i.current_firm_id = $${addParam(firmId)}`);
    }

    if (minCheckSize) {
      conditions.push(`i.min_check_size >= $${addParam(parseInt(minCheckSize))}`);
    }
    if (maxCheckSize) {
      conditions.push(`i.max_check_size >= $${addParam(parseInt(maxCheckSize))}`);
    }

    const whereClause = conditions.join(" AND ");
    const joinClause = "FROM investors i LEFT JOIN investor_firms f ON i.current_firm_id = f.id";

    // ── Count total ──
    const countResult = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count ${joinClause} WHERE ${whereClause}`,
      params
    );
    const total = countResult[0]?.count || 0;

    // ── Fetch page ──
    addParam(limit);
    addParam(offset);

    const investors = await query<any>(
      `SELECT i.*, f.name AS firm_name ${joinClause}
       WHERE ${whereClause}
       ORDER BY i.${sortBy} ${sortDir} NULLS LAST
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`,
      params
    );

    return NextResponse.json({
      investors,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      filters: {
        search, type, sector, stage, country, city, readiness,
        verified, minScore, maxScore, minQuality, hasEmail, hasLinkedin,
        firmId, minCheckSize, maxCheckSize,
      },
    });
  } catch (err) {
    console.error("Investors list error:", err);
    return NextResponse.json(
      { error: "Failed to load investors" },
      { status: 500 }
    );
  }
}
