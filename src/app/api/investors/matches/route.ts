// =============================================
// API: Matches — ranked investors with an explanation
// =============================================
// GET  /api/investors/matches?band=strong|possible|poor|all
// POST /api/investors/matches  { investorId, verdict: "good_match" | "not_a_fit", reason? }
//
// Matches reads the batch fit score and its stored breakdown. It never invents
// a factor: if the breakdown is missing, the row says the score is unexplained
// rather than rendering an empty explanation. Confidence is the completeness of
// the evidence behind the score, so a 92 built on four known fields out of nine
// is presented as a low-confidence 92, not as certainty.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

const FIELDS =
  "id, full_name, email, linkedin_url, investor_type, fit_score, fit_score_breakdown, data_quality_score, outreach_readiness, investment_stages, investment_sectors, country, current_firm_id, min_check_size, max_check_size";

type Breakdown = {
  factors?: Array<{ factor: string; score: number; weight: number; explanation: string }>;
  confidence?: number;
  dataQuality?: number;
};

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const BANDS = ["strong", "possible", "poor"] as const;
type ScoredBand = (typeof BANDS)[number];
type Band = ScoredBand | "all";

/** Factors whose explanation admits the evidence is absent. */
function missingEvidence(factors: Breakdown["factors"]): string[] {
  if (!factors) return [];
  return factors
    .filter((f) => /insufficient|not specified|no .*data|missing|unknown|no geography/i.test(f.explanation))
    .map((f) => f.factor);
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const sp = getSp();
  const url = request.nextUrl;
  const rawBand = url.searchParams.get("band") || "all";
  const band: Band = BANDS.includes(rawBand as ScoredBand) ? (rawBand as ScoredBand) : "all";
  const limit = Math.min(100, Math.max(10, Number(url.searchParams.get("limit") || 40)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

  try {
    // Band counts come from the same predicate as the list, so the tabs and the
    // rows cannot disagree.
    const countFor = async (b: Band) => {
      let q = sp
        .from("investors")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .gt("fit_score", 0);
      if (b === "strong") q = q.gte("fit_score", 80);
      if (b === "possible") q = q.gte("fit_score", 50).lt("fit_score", 80);
      if (b === "poor") q = q.lt("fit_score", 50);
      const { count } = await q;
      return count ?? 0;
    };

    let listQuery = sp
      .from("investors")
      .select(FIELDS, { count: "exact" })
      .eq("is_active", true)
      .gt("fit_score", 0);
    if (band === "strong") listQuery = listQuery.gte("fit_score", 80);
    if (band === "possible") listQuery = listQuery.gte("fit_score", 50).lt("fit_score", 80);
    if (band === "poor") listQuery = listQuery.lt("fit_score", 50);

    const [strong, possible, poor, listRes, profileRes, feedbackRes] = await Promise.all([
      countFor("strong"),
      countFor("possible"),
      countFor("poor"),
      listQuery.order("fit_score", { ascending: false }).range(offset, offset + limit - 1),
      sp
        .from("company_profiles")
        .select("industry, company_stage, location, funding_amount, target_cheque_min, target_cheque_max")
        .eq("user_id", user.id)
        .maybeSingle(),
      sp.from("fit_feedback").select("investor_id, verdict").eq("user_id", user.id),
    ]);

    if (listRes.error) throw listRes.error;

    const verdicts = new Map<string, string>(
      (feedbackRes.data ?? []).map((r) => [r.investor_id as string, r.verdict as string])
    );

    const rows = (listRes.data ?? []).map((inv) => {
      const breakdown = (inv.fit_score_breakdown ?? null) as Breakdown | null;
      const factors = breakdown?.factors ?? [];
      const confidence =
        typeof breakdown?.confidence === "number"
          ? breakdown.confidence
          : typeof breakdown?.dataQuality === "number"
            ? breakdown.dataQuality
            : null;

      return {
        id: inv.id,
        full_name: inv.full_name,
        email: inv.email,
        linkedin_url: inv.linkedin_url,
        investor_type: inv.investor_type,
        fit_score: inv.fit_score ?? 0,
        confidence,
        factors,
        explanationMissing: factors.length === 0,
        missingEvidence: missingEvidence(factors),
        outreach_readiness: inv.outreach_readiness,
        investment_stages: inv.investment_stages ?? [],
        investment_sectors: inv.investment_sectors ?? [],
        country: inv.country,
        firm_name: null as string | null,
        min_check_size: inv.min_check_size,
        max_check_size: inv.max_check_size,
        verdict: verdicts.get(inv.id as string) ?? null,
      };
    });

    // Fields the scorer needs from the founder's own profile. Without them the
    // scores exist but are largely measuring the corpus, not this company.
    const p = profileRes.data;
    const profileMissing: string[] = [];
    if (!p?.industry) profileMissing.push("Industry");
    if (!p?.company_stage) profileMissing.push("Company stage");
    if (!p?.location) profileMissing.push("Location");
    if (p?.funding_amount === null || p?.funding_amount === undefined) profileMissing.push("Target raise");
    if (p?.target_cheque_min === null && p?.target_cheque_max === null) profileMissing.push("Cheque range");

    return NextResponse.json(
      {
        matches: rows,
        total: listRes.count ?? rows.length,
        page: Math.floor(offset / limit) + 1,
        limit,
        offset,
        counts: { strong, possible, poor, all: strong + possible + poor },
        profileMissing,
        // What the score is: one sentence, so the number is never a mystery.
        basis:
          "Batch fit score across the shared corpus, with the stored factor breakdown and its evidence-completeness confidence.",
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
