// =============================================
// Auto-Enrichment Service
// =============================================
// Runs automatically on new investor imports.
// Computes data_quality_score, outreach_readiness,
// logs provenance, and links firms.
// Uses CockroachDB for data.

import { query } from "@/lib/db";

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
  const entries: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

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

  for (const [dbField] of Object.entries(fieldMap)) {
    if (fields[dbField]) {
      entries.push(
        `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
      );
      params.push(
        investorId,
        dbField,
        "provider",
        source,
        typeof fields[dbField] === "string" ? fields[dbField] : JSON.stringify(fields[dbField]),
        0.7
      );
    }
  }

  if (entries.length > 0) {
    await query(
      `INSERT INTO investor_data_sources (investor_id, field_name, source_type, source_provider, source_value, confidence)
       VALUES ${entries.join(", ")}`,
      params
    );
  }
}

// =============================================
// Main Enrichment Function
// =============================================

export async function enrichInvestor(investorId: string): Promise<EnrichmentResult | null> {
  const investors = await query<any>(
    `SELECT * FROM investors WHERE id = $1`,
    [investorId]
  );

  if (!investors.length) return null;
  const investor = investors[0];

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
  await query(
    `UPDATE investors SET data_quality_score = $1, outreach_readiness = $2, last_enriched_at = NOW() WHERE id = $3`,
    [dataQualityScore, outreachReadiness, investorId]
  );

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
  // Fetch investors not yet enriched
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const investors = await query<{ id: string }>(
    `SELECT id FROM investors WHERE is_active = true
     AND (last_enriched_at IS NULL OR last_enriched_at < $1)
     ORDER BY created_at DESC LIMIT $2`,
    [sevenDaysAgo, limit]
  );

  if (!investors.length) {
    return { enriched: 0, skipped: 0, errors: 0 };
  }

  let enriched = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches
  const BATCH = 50;
  for (let i = 0; i < investors.length; i += BATCH) {
    const batch = investors.slice(i, i + BATCH);
    const batchIds = batch.map((inv) => inv.id);

    // Bulk fetch data
    const placeholders = batchIds.map((_, j) => `$${j + 1}`).join(", ");
    const invData = await query<any>(
      `SELECT * FROM investors WHERE id IN (${placeholders})`,
      batchIds
    );

    for (const inv of invData) {
      try {
        const score = computeDataQuality(inv);
        const readiness = computeOutreachReadiness(inv);

        await query(
          `UPDATE investors SET data_quality_score = $1, outreach_readiness = $2, last_enriched_at = NOW() WHERE id = $3`,
          [score, readiness, inv.id]
        );

        enriched++;
      } catch {
        errors++;
      }
    }
  }

  return { enriched, skipped, errors };
}
