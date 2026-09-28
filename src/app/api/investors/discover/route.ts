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

Return ONLY minified JSON, no other text.

Examples:
Input: seed stage investors in the United States focused on robotics or industrial automation
Output: {"keywords":["robotics","industrial automation"],"stages":["seed"],"sectors":["robotics"],"countries":["United States"],"investor_types":[],"has_email":false}

Input: European fintech VCs with emails I can contact for our $5M Series A
Output: {"keywords":["fintech"],"stages":["series_a"],"sectors":["fintech"],"countries":["Europe"],"investor_types":["venture_capital"],"has_email":true}

Input: family offices writing $500k checks in healthcare
Output: {"keywords":["healthcare"],"stages":[],"sectors":["healthcare"],"countries":[],"investor_types":["family_office"],"has_email":false}

Field rules:
- keywords: 2-4 concrete search words or phrases describing the investor, firm, or thesis. Use real words — never placeholders.
- stages: only values from ${JSON.stringify(ALLOWED_STAGES)}
- sectors: lowercase sector words the investor should invest in
- countries: country names, or "Europe" for a European focus
- investor_types: only values from ${JSON.stringify(ALLOWED_TYPES)}
- has_email: true only if the user explicitly asks for contactable investors or emails
- Include every field even if empty. Never invent values not implied by the request.`;

function sanitizeArray(values: unknown, allowed?: string[], max = 6): string[] {
  if (!Array.isArray(values)) return [];
  const cleaned = values
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().toLowerCase().replace(/[,()]/g, " ").trim())
    .filter(Boolean)
    .filter((v) => v.length > 1 && !/^[.\s]*$|^\.\.|^n\/a$|^none$|^unknown$|^example$/.test(v));
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
    const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ai);
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
    // Dormancy + evidence filters (targeting active SEC filers, not stale rows)
    const filingRecency: string | null = ["1y", "3y"].includes(body.filingRecency) ? body.filingRecency : null;
    const hasSecEvidence: boolean = body.hasSecEvidence === true;

    // ── Parse natural language into structured filters (best effort) ──
    let parsed: ParsedQuery | null = null;
    if (query.length > 3) {
      for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
        try {
          const result = await chatCompletion({
            task: "query_parsing",
            systemPrompt: SYSTEM_PROMPT,
            messages: [{ role: "user", content: query }],
          });
          parsed = parseModelOutput(result.content);
        } catch {
          parsed = null; // fall back to keyword extraction below
        }
      }
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── Build the database query ──
    const baseSelect = "id, full_name, job_title, country, city, fit_score, fit_score_breakdown, investor_type, investment_stages, investment_sectors, email, linkedin_url, outreach_readiness, bio, is_verified, data_quality_score, edgar_last_filing_date, verification_status, source_provider";

    // Text search: keywords go to name/title/bio. When AI parsing failed,
    // extract meaningful words from the query (never search the raw sentence
    // as one blob — it can never match).
    const STOPWORDS = new Set(["the", "and", "for", "with", "that", "this", "who", "can", "lead", "leads", "invest", "investing", "investors", "investor", "based", "focused", "focus", "stage", "sector", "seed", "series", "fund", "funds", "startup", "startups", "looking", "want", "need", "into", "from", "your", "our", "are", "will", "about", "million", "raise", "raising"]);
    const searchTerms = parsed ? [...parsed.keywords] : [];
    if (!parsed && query) {
      const words = query
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
      searchTerms.push(...[...new Set(words)].slice(0, 4));
    }

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
      if (filingRecency) {
        const cutoff = new Date(Date.now() - (filingRecency === "1y" ? 365 : 3 * 365) * 86_400_000).toISOString().slice(0, 10);
        b = b.gte("edgar_last_filing_date", cutoff);
      }
      if (hasSecEvidence) b = b.not("edgar_sic_code", "is", null); // SEC-verified rows carry their SIC classification
      return b;
    };

    const { data: investors, error } = await applyFilters(
      supabase.from("investors").select(baseSelect).eq("is_active", true).order(sortBy, { ascending: sortDir, nullsFirst: false })
    ).limit(limit);

    if (error) {
      console.error("Discover search query error:", error);
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    // ── Count total matches (same filters, head count) ──
    const { count } = await applyFilters(
      supabase.from("investors").select("id", { count: "exact", head: true }).eq("is_active", true)
    );

    const today = new Date().toISOString().slice(0, 10);
    const decorated = (investors || []).map((row: any) => ({
      ...row,
      filing_recency: row.edgar_last_filing_date
        ? Date.now() - new Date(row.edgar_last_filing_date).getTime() <= 365 * 86_400_000
          ? "filing_1y"
          : Date.now() - new Date(row.edgar_last_filing_date).getTime() <= 3 * 365 * 86_400_000
          ? "filing_3y"
          : "dormant_3y_plus"
        : "no_evidence",
      sec_verified: row.verification_status === "verified" && !!row.edgar_last_filing_date && !!(row.source_provider || "").toLowerCase().match(/edgar|sec/),
    }));

    return NextResponse.json({
      investors: decorated,
      total: count || investors?.length || 0,
      parsed: parsed || null, // let the UI show how the query was understood
      fallback: !parsed && query.length > 3,
    });
  } catch (err) {
    console.error("Discover search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
