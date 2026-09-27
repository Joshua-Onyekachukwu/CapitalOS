// =============================================
// AI-Powered Investor Search (Discover page)
// =============================================
// Turns a founder's natural-language query into structured filters via the
// AI layer, then applies them to the investors table. Falls back to plain
// text search when parsing fails so the page is never worse than before.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { chatCompletion } from "@/lib/ai";
import { createClient } from "@supabase/supabase-js";

// ── Structured shape the AI must return ──
interface ParsedQuery {
  keywords: string[];
  stages: string[];
  sectors: string[];
  countries: string[];
  investor_types: string[];
  has_email: boolean;
}

const ALLOWED_STAGES = ["pre_seed", "seed", "series_a", "series_b", "series_c", "growth", "late_stage"];
const ALLOWED_TYPES = ["venture_capital", "angel_investor", "family_office", "fund_of_funds", "private_equity", "corporate_vc", "strategic_investor", "government_fund", "university_fund"];

const SYSTEM_PROMPT = `Parse the user's investor search request into JSON filters.

Return ONLY minified JSON, no other text. Shape:
{"keywords":["..."],"stages":[],"sectors":[],"countries":[],"investor_types":[],"has_email":false}

Field rules:
- keywords: 2-4 search words or short phrases describing the investor, firm, or thesis (e.g. "robotics", "industrial automation"). Empty array if none.
- stages: only values from ${JSON.stringify(ALLOWED_STAGES)}
- sectors: lowercase sector words the investor should invest in (e.g. "fintech", "healthcare", "saas")
- countries: country names the investor should be based in or invest in
- investor_types: only values from ${JSON.stringify(ALLOWED_TYPES)}
- has_email: true only if the user explicitly asks for contactable investors or emails
- Omit empty arrays. Never invent values that are not implied by the request.`;

function sanitizeArray(values: unknown, allowed?: string[], max = 6): string[] {
  if (!Array.isArray(values)) return [];
  const cleaned = values
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().toLowerCase().replace(/[,()]/g, " ").trim())
    .filter(Boolean);
  const unique = [...new Set(cleaned)];
  return allowed ? unique.filter((v) => allowed.includes(v)).slice(0, max) : unique.slice(0, max);
}

// The DB stores full country names; users (and the model) often write "US",
// "UK", "Europe". Expand common aliases to the actual stored values.
const COUNTRY_ALIASES: Record<string, string[]> = {
  "us": ["united states"],
  "usa": ["united states"],
  "u.s": ["united states"],
  "america": ["united states"],
  "united states of america": ["united states"],
  "uk": ["united kingdom"],
  "u.k": ["united kingdom"],
  "britain": ["united kingdom"],
  "great britain": ["united kingdom"],
  "england": ["united kingdom"],
  "europe": ["united kingdom", "switzerland", "france", "luxembourg"],
};

function expandCountries(values: unknown): string[] {
  const cleaned = sanitizeArray(values, undefined, 5);
  const expanded = cleaned.flatMap((c) => COUNTRY_ALIASES[c] || [c]);
  return [...new Set(expanded)].slice(0, 6);
}

function parseModelOutput(raw: string): ParsedQuery | null {
  // Extract the first JSON object from the response (models may add prose)
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1));
    return {
      keywords: sanitizeArray(obj.keywords, undefined, 4),
      stages: sanitizeArray(obj.stages, ALLOWED_STAGES),
      sectors: sanitizeArray(obj.sectors, undefined, 4),
      countries: expandCountries(obj.countries),
      investor_types: sanitizeArray(obj.investor_types, ALLOWED_TYPES),
      has_email: obj.has_email === true,
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.ai);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }

    const body = await request.json().catch(() => ({}));
    const query: string = (body.query || "").trim();
    const sortBy = ["fit_score", "data_quality_score", "created_at", "full_name"].includes(body.sortBy) ? body.sortBy : "fit_score";
    const sortDir = body.sortDirection === "asc";
    const limit = Math.min(100, Math.max(1, parseInt(body.limit) || 50));
    // Explicit dropdown filters from the UI (applied verbatim, no parsing)
    const explicitStage: string = (body.stage || "").trim().toLowerCase();
    const explicitSector: string = (body.sector || "").trim().toLowerCase();
    const explicitCountry: string = (body.country || "").trim();

    // ── Parse natural language into structured filters (best effort) ──
    let parsed: ParsedQuery | null = null;
    if (query.length > 3) {
      try {
        const result = await chatCompletion({
          task: "query_parsing",
          systemPrompt: SYSTEM_PROMPT,
          messages: [{ role: "user", content: query }],
          maxRetries: 1,
        });
        parsed = parseModelOutput(result.content);
      } catch {
        parsed = null; // fall back to plain text search below
      }
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── Build the database query ──
    const baseSelect = "id, full_name, job_title, country, city, fit_score, fit_score_breakdown, investor_type, investment_stages, investment_sectors, email, linkedin_url, outreach_readiness, bio, is_verified, data_quality_score";

    // Text search: keywords go to name/title/bio, the raw query as a safety net
    const searchTerms = parsed ? [...parsed.keywords] : [];
    if (!parsed && query) searchTerms.push(query.replace(/[,()]/g, " ").trim());

    // Sector matching helper — sector arrays are sparsely populated in this
    // dataset, so match the array OR sector keywords in bio/job_title.
    const sectorFilters = [
      ...((parsed?.sectors || [])),
      ...(explicitSector ? [explicitSector] : []),
    ];

    const applyFilters = (b: any) => {
      if (searchTerms.length > 0) {
        const ors = searchTerms.flatMap((t) => [
          `full_name.ilike.%${t}%`,
          `job_title.ilike.%${t}%`,
          `bio.ilike.%${t}%`,
        ]);
        b = b.or(ors.join(","));
      }
      const stages = [...(parsed?.stages || []), ...(explicitStage ? [explicitStage] : [])];
      if (stages.length > 0) b = b.overlaps("investment_stages", stages);
      if (sectorFilters.length > 0) {
        const sectorOrs = sectorFilters.flatMap((s) => [`bio.ilike.%${s}%`, `job_title.ilike.%${s}%`]);
        b = b.or(`investment_sectors.ov.{${sectorFilters.join(",")}},${sectorOrs.join(",")}`);
      }
      const countries = [...(parsed?.countries || []), ...(explicitCountry ? [explicitCountry] : [])];
      if (countries.length > 0) b = b.or(countries.map((c) => `country.ilike.%${c}%`).join(","));
      if (parsed?.investor_types.length) b = b.in("investor_type", parsed.investor_types);
      if (parsed?.has_email) b = b.not("email", "is", null).neq("email", "");
      return b;
    };

    const { data: investors, error } = await applyFilters(
      supabase.from("investors").select(baseSelect).order(sortBy, { ascending: sortDir, nullsFirst: false })
    ).limit(limit);

    if (error) {
      console.error("Discover search query error:", error);
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    // ── Count total matches (same filters, head count) ──
    const { count } = await applyFilters(
      supabase.from("investors").select("id", { count: "exact", head: true })
    );

    return NextResponse.json({
      investors: investors || [],
      total: count || investors?.length || 0,
      parsed: parsed || null, // let the UI show how the query was understood
      fallback: !parsed && query.length > 3,
    });
  } catch (err) {
    console.error("Discover search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
