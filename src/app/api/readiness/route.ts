import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  assessReadiness,
  type ReadinessDocument,
  type ReadinessProfile,
} from "@/lib/services/readiness/score";

/**
 * GET /api/readiness
 *
 * Computes the founder's readiness assessment from their own records and
 * returns the full breakdown. Everything is scoped by RLS to the caller; there
 * is no id parameter to tamper with, which is why this route cannot leak another
 * tenant's company.
 *
 * Side effect: `company_profiles.readiness_score` is refreshed when it differs
 * from the computed value, so dashboards that read the column directly cannot
 * disagree with this page. The write is idempotent and touches one row.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: row, error: profileError } = await supabase
    .from("company_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Could not load your company profile", detail: profileError.message },
      { status: 500 }
    );
  }

  // A founder who has not created a profile yet gets an actionable empty state,
  // not a fabricated score of 0 with no explanation.
  if (!row) {
    return NextResponse.json({ hasProfile: false });
  }

  const [docsResult, teamResult] = await Promise.all([
    supabase
      .from("company_documents")
      .select("document_type, file_url")
      .eq("company_id", row.id),
    supabase
      .from("company_team_members")
      .select("name, title, bio, is_founder")
      .eq("company_id", row.id),
  ]);

  if (docsResult.error || teamResult.error) {
    return NextResponse.json(
      {
        error: "Could not load your documents or team",
        detail: docsResult.error?.message || teamResult.error?.message,
      },
      { status: 500 }
    );
  }

  const profile: ReadinessProfile = {
    companyName: row.company_name,
    industry: row.industry,
    location: row.location,
    websiteUrl: row.website_url,
    companyStage: row.company_stage,
    businessModel: row.business_model,
    oneLiner: row.one_liner,
    description: row.description,
    differentiator: row.differentiator,
    targetCustomer: row.target_customer,
    currentlyRaising: Boolean(row.currently_raising),
    fundingAmount: row.funding_amount === null ? null : Number(row.funding_amount),
    roundType: row.round_type,
    targetChequeMin: row.target_cheque_min === null ? null : Number(row.target_cheque_min),
    targetChequeMax: row.target_cheque_max === null ? null : Number(row.target_cheque_max),
    mrr: row.mrr === null ? null : Number(row.mrr),
    arr: row.arr === null ? null : Number(row.arr),
    customerCount: row.customer_count,
    growthRate: row.growth_rate,
    milestones: Array.isArray(row.milestones) ? row.milestones : [],
    employeeCount: row.employee_count,
  };

  const documents: ReadinessDocument[] = (docsResult.data || []).map((d) => ({
    documentType: d.document_type,
    hasFile: typeof d.file_url === "string" && d.file_url.length > 0,
  }));

  const teamMembers = (teamResult.data || []).map((m) => ({
    name: m.name as string,
    title: m.title as string | null,
    bio: m.bio as string | null,
    isFounder: Boolean(m.is_founder),
  }));

  const assessment = assessReadiness({ profile, documents, teamMembers });

  // Keep the column honest. A failed sync must not break the assessment the
  // founder is reading, so the error is reported alongside a successful body.
  let persisted = true;
  if (row.readiness_score !== assessment.score) {
    const { error: updateError } = await supabase
      .from("company_profiles")
      .update({ readiness_score: assessment.score })
      .eq("user_id", user.id);
    persisted = !updateError;
  }

  return NextResponse.json(
    {
      hasProfile: true,
      companyName: row.company_name,
      persisted,
      ...assessment,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
