// =============================================
// API: Matches — ranked investors with an explanation
// =============================================
// GET  /api/investors/matches?band=strong|possible|poor|all
// POST /api/investors/matches  { investorId, verdict: "good_match" | "not_a_fit", reason? }
//
// Matching is computed per founder against the live corpus, not read from a
// global fit_score. A single stored score cannot be right for two founders in
// different sectors and stages. Every factor names its evidence; a missing
// field lowers the score and is reported as missing rather than scored as a
// neutral pass.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";
import { computeFitScore, type FitFactor } from "@/lib/services/investor/fit-scoring";

const POOL_FIELDS =
  "id, full_name, email, linkedin_url, investor_type, investment_stages, investment_sectors, investment_geographies, country, city, current_firm_id, min_check_size, max_check_size, website_url, data_quality_score, outreach_readiness, provenance";

const SCORED_TYPES = [
  "venture_capital",
  "micro_vc",
  "corporate_venture",
  "angel_syndicate",
  "accelerator",
  "family_office",
];

type Band = "all" | "strong" | "possible" | "poor";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function missingEvidence(factors: FitFactor[]): string[] {
  return factors
    .filter((f) => f.score === 0 || /not scored|no .*data|missing|no cheque/i.test(f.explanation))
    .map((f) => f.factor);
}

async function loadPool(sp: ReturnType<typeof getSp>) {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sp
      .from("investors")
      .select(POOL_FIELDS)
      .eq("is_active", true)
      .in("investor_type", SCORED_TYPES)
      .order("data_quality_score", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const sp = getSp();
  const url = request.nextUrl;
  const rawBand = url.searchParams.get("band") || "all";
  const band: Band = (["strong", "possible", "poor"] as string[]).includes(rawBand)
    ? (rawBand as Band)
    : "all";
  const limit = Math.min(100, Math.max(10, Number(url.searchParams.get("limit") || 40)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

  try {
    const { data: profile } = await sp
      .from("company_profiles")
      .select("industry, company_stage, location, country, funding_amount, target_cheque_min, target_cheque_max")
      .eq("user_id", user.id)
      .maybeSingle();

    const profileMissing: string[] = [];
    if (!profile?.industry) profileMissing.push("Industry");
    if (!profile?.company_stage) profileMissing.push("Company stage");
    if (!(profile?.location || profile?.country)) profileMissing.push("Location");

    const startup = {
      sector: profile?.industry ?? "",
      stage: profile?.company_stage ?? "",
      geography: profile?.location || profile?.country || "",
    };

    // Without a sector or stage there is nothing to match on. Saying so is the
    // honest answer; ranking the corpus anyway would produce noise.
    if (!startup.sector || !startup.stage) {
      return NextResponse.json(
        {
          matches: [],
          total: 0,
          page: 1,
          limit,
          offset: 0,
          counts: { strong: 0, possible: 0, poor: 0, all: 0 },
          profileMissing,
          basis:
            "Matches are computed from your company profile. Add an industry and stage to score the corpus.",
        },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const [pool, feedbackRes] = await Promise.all([
      loadPool(sp),
      sp.from("fit_feedback").select("investor_id, verdict").eq("user_id", user.id),
    ]);

    const verdicts = new Map<string, string>(
      (feedbackRes.data ?? []).map((r) => [r.investor_id as string, r.verdict as string])
    );

    const scored = pool
      .map((inv) => {
        const fit = computeFitScore(inv, startup);
        return { inv, ...fit };
      })
      .filter((row) => row.overallScore > 0)
      .sort(
        (a, b) =>
          b.overallScore - a.overallScore ||
          ((b.inv.data_quality_score as number) ?? 0) - ((a.inv.data_quality_score as number) ?? 0)
      );

    const counts = {
      strong: scored.filter((r) => r.overallScore >= 80).length,
      possible: scored.filter((r) => r.overallScore >= 50 && r.overallScore < 80).length,
      poor: scored.filter((r) => r.overallScore < 50).length,
      all: scored.length,
    };

    const filtered = scored.filter((r) => {
      if (band === "strong") return r.overallScore >= 80;
      if (band === "possible") return r.overallScore >= 50 && r.overallScore < 80;
      if (band === "poor") return r.overallScore < 50;
      return true;
    });

    const page = filtered.slice(offset, offset + limit);

    const firmIds = [...new Set(page.map((r) => r.inv.current_firm_id as string).filter(Boolean))];
    const firmNames = new Map<string, string>();
    if (firmIds.length) {
      const { data: firms } = await sp.from("investor_firms").select("id,name").in("id", firmIds);
      for (const f of firms ?? []) firmNames.set(f.id as string, f.name as string);
    }

    const matches = page.map(({ inv, overallScore, factors, confidence }) => ({
      id: inv.id,
      full_name: inv.full_name,
      email: inv.email,
      linkedin_url: inv.linkedin_url,
      investor_type: inv.investor_type,
      fit_score: overallScore,
      confidence,
      factors,
      explanationMissing: factors.length === 0,
      missingEvidence: missingEvidence(factors),
      outreach_readiness: inv.outreach_readiness,
      investment_stages: inv.investment_stages ?? [],
      investment_sectors: inv.investment_sectors ?? [],
      country: inv.country,
      firm_name: inv.current_firm_id ? firmNames.get(inv.current_firm_id as string) ?? null : null,
      min_check_size: inv.min_check_size,
      max_check_size: inv.max_check_size,
      website_url: inv.website_url,
      verdict: verdicts.get(inv.id as string) ?? null,
    }));

    return NextResponse.json(
      {
        matches,
        total: filtered.length,
        page: Math.floor(offset / limit) + 1,
        limit,
        offset,
        counts,
        profileMissing,
        basis:
          "Computed for your company's sector, stage and geography against the live investor corpus. Each factor shows its evidence; missing fields are marked, not guessed.",
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("[matches] load failed:", err);
    return NextResponse.json({ error: "Failed to load matches" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const investorId = typeof body.investorId === "string" ? body.investorId : null;
  const verdict = typeof body.verdict === "string" ? body.verdict : null;
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;

  if (!investorId) return NextResponse.json({ error: "investorId is required" }, { status: 400 });
  if (verdict !== "good_match" && verdict !== "not_a_fit") {
    return NextResponse.json(
      { error: "verdict must be good_match or not_a_fit" },
      { status: 400 }
    );
  }

  const sp = getSp();
  const { error } = await sp.from("fit_feedback").upsert(
    {
      user_id: user.id,
      investor_id: investorId,
      verdict,
      reason,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,investor_id" }
  );

  if (error) {
    console.error("[matches] feedback failed:", error);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  return NextResponse.json({ success: true, investorId, verdict });
}
