// =============================================
// Auto-Enrichment Service
// =============================================
// Runs automatically on new investor imports.
// Computes data_quality_score, outreach_readiness,
// logs provenance, and links firms.

import { createClient } from "@supabase/supabase-js";

// =============================================
// Types
// =============================================

interface EnrichmentResult {
  investorId: string;
  dataQualityScore: number;
  outreachReadiness: string;
  fieldsPopulated: string[];
  fieldsMissing: string[];
  sourceLogged: boolean;
}

// =============================================
// Data Quality Scoring
// =============================================

function computeDataQuality(investor: Record<string, unknown>): number {
  const fields = [
    { key: "email", weight: 15 },
    { key: "linkedin_url", weight: 15 },
    { key: "job_title", weight: 12 },
    { key: "phone", weight: 10 },
    { key: "bio", weight: 10, minLength: 50 },
    { key: "investment_stages", weight: 10, isArray: true },
    { key: "investment_sectors", weight: 10, isArray: true },
    { key: "country", weight: 8 },
    { key: "city", weight: 5 },
    { key: "website_url", weight: 5 },
  ];

  let score = 0;

  for (const field of fields) {
    const val = investor[field.key];
    if (field.isArray) {
      if (Array.isArray(val) && val.length > 0) score += field.weight;
    } else if (field.minLength) {
      if (typeof val === "string" && val.length >= field.minLength) score += field.weight;
    } else {
      if (val) score += field.weight;
    }
  }

  return Math.min(score, 100);
}

// =============================================
// Outreach Readiness Scoring
// =============================================

function computeOutreachReadiness(investor: Record<string, unknown>): string {
  if (investor.do_not_contact) return "do_not_contact";

  let score = 0;
  if (investor.email) score += 30;
  if (investor.linkedin_url) score += 20;
  if (investor.is_verified) score += 15;
  if ((investor.data_quality_score as number) >= 70) score += 15;
  if (Array.isArray(investor.investment_sectors) && investor.investment_sectors.length > 0) score += 10;
  if (investor.bio && (investor.bio as string).length > 50) score += 10;

  if (score >= 70) return "ready";
  if (score >= 40) return "needs_verification";
  return "not_ready";
}

// =============================================
// Provenance Logging
// =============================================

async function logProvenance(
  investorId: string,
  source: string,
  sourceId: string | null,
  fields: Record<string, unknown>
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const entries: Record<string, unknown>[] = [];

  const fieldMap: Record<string, string> = {
    email: "email",
    linkedin_url: "linkedin_url",
    job_title: "job_title",
    phone: "phone",
    country: "country",
    city: "city",
    bio: "bio",
    investment_stages: "investment_stages",
    investment_sectors: "investment_sectors",
  };

  for (const [dbField, _] of Object.entries(fieldMap)) {
    if (fields[dbField]) {
      entries.push({
        investor_id: investorId,
        field_name: dbField,
        source_type: "provider",
        source_provider: source,
        source_value: typeof fields[dbField] === "string" ? fields[dbField] : JSON.stringify(fields[dbField]),
        confidence: 0.7,
      });
    }
  }

  if (entries.length > 0) {
    await supabase.from("investor_data_sources").insert(entries);
  }
}

// =============================================
// Main Enrichment Function
// =============================================

export async function enrichInvestor(investorId: string): Promise<EnrichmentResult | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: investor } = await supabase
    .from("investors")
    .select("*")
    .eq("id", investorId)
    .single();

  if (!investor) return null;

  const dataQualityScore = computeDataQuality(investor);
  const outreachReadiness = computeOutreachReadiness(investor);

  // Determine populated vs missing fields
  const criticalFields = ["email", "linkedin_url", "job_title", "country", "city", "bio", "investment_stages", "investment_sectors"];
  const fieldsPopulated = criticalFields.filter((f) => {
    const val = investor[f];
    return val && (Array.isArray(val) ? val.length > 0 : true);
  });
  const fieldsMissing = criticalFields.filter((f) => !fieldsPopulated.includes(f));

  // Update investor record
  await supabase
    .from("investors")
    .update({
      data_quality_score: dataQualityScore,
      outreach_readiness: outreachReadiness,
      last_enriched_at: new Date().toISOString(),
    })
    .eq("id", investorId);

  // Log provenance for key fields
  await logProvenance(investorId, investor.source || "unknown", investor.source_id || null, investor);

  return {
    investorId,
    dataQualityScore,
    outreachReadiness,
    fieldsPopulated,
    fieldsMissing,
    sourceLogged: true,
  };
}

// =============================================
// Batch Enrichment
// =============================================

export async function enrichBatch(
  limit: number = 500
): Promise<{ enriched: number; skipped: number; errors: number }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch investors not yet enriched (no last_enriched_at or enriched > 7 days ago)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: investors } = await supabase
    .from("investors")
    .select("id")
    .eq("is_active", true)
    .or(`last_enriched_at.is.null,last_enriched_at.lt.${sevenDaysAgo}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!investors || investors.length === 0) {
    return { enriched: 0, skipped: 0, errors: 0 };
  }

  let enriched = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches to avoid Supabase limits
  const BATCH = 50;
  for (let i = 0; i < investors.length; i += BATCH) {
    const batch = investors.slice(i, i + BATCH);
    const batchIds = batch.map((inv) => inv.id);

    // Bulk compute data quality scores
    const { data: invData } = await supabase
      .from("investors")
      .select("*")
      .in("id", batchIds);

    if (!invData) { errors += batch.length; continue; }

    for (const inv of invData) {
      try {
        const score = computeDataQuality(inv);
        const readiness = computeOutreachReadiness(inv);

        await supabase
          .from("investors")
          .update({
            data_quality_score: score,
            outreach_readiness: readiness,
            last_enriched_at: new Date().toISOString(),
          })
          .eq("id", inv.id);

        enriched++;
      } catch {
        errors++;
      }
    }
  }

  return { enriched, skipped, errors };
}
