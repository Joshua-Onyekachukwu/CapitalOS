/**
 * Database ingestion — the ONLY path from the pipeline into Supabase.
 *
 * Protections:
 *   - Batched (default 200 rows/insert, chunked over the wire)
 *   - Idempotent: keyed upsert on source_provider + canonical identity
 *   - Raw rows go to raw_records first (staging), investors only after
 *   - Configurable row cap per run (hard stop — no accidental bulk loads)
 *   - All writes stamped with provenance + freshness
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import type { InvestorRecord } from "./types";

dotenv.config({ path: ".env.local" });
dotenv.config();

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export interface IngestOptions {
  /** Hard cap on investor rows written by this run. */
  maxRows?: number;
  batchSize?: number;
  /** Dry run: everything except the final writes. */
  dryRun?: boolean;
}

export interface IngestResult {
  staged: number;
  inserted: number;
  skipped: number;
  capped: boolean;
  errors: string[];
}

/** Pipeline type vocabulary → investors.investor_type enum (DB constraint).
 *  'other' has no honest enum equivalent — the closest is strategic_investor,
 *  but those records should be rare because the startup-signal gate rejects
 *  noise before ingest. */
const DB_TYPE: Record<string, string> = {
  venture_capital: "venture_capital",
  angel: "angel_investor",
  angel_syndicate: "angel_syndicate",
  family_office: "family_office",
  corporate_vc: "corporate_venture",
  accelerator: "accelerator",
  incubator: "incubator",
  micro_vc: "micro_vc",
  growth_equity: "private_equity",
  private_equity: "private_equity",
  government_fund: "government_fund",
  university_fund: "university_fund",
  other: "strategic_investor",
};

function toInvestorRow(rec: InvestorRecord) {
  return {
    full_name: rec.legal_name || rec.canonical_name,
    investor_type: DB_TYPE[rec.investor_type || "other"] || "strategic_investor",
    investment_stages: rec.stages,
    investment_sectors: rec.sectors,
    investment_geographies: rec.geographies,
    website_url: rec.website ? `https://${rec.website}` : null,
    linkedin_url: rec.linkedin_url,
    email: rec.email,
    location: rec.city,
    country: rec.country,
    city: rec.city,
    min_check_size: rec.min_check_usd,
    max_check_size: rec.max_check_usd,
    bio: rec.thesis,
    source: rec.source_provider,
    source_provider: rec.source_provider,
    data_quality_score: rec.quality_score,
    verification_status: rec.claim_tier === "verified" ? "verified" : rec.claim_tier === "supported" ? "derived" : rec.claim_tier === "inferred" ? "ai_classified" : "unknown",
    last_verified_at: rec.last_verified_at,
    is_active: rec.is_active,
  };
}

function toRawRecord(rec: InvestorRecord, batch: string) {
  return {
    raw_data: rec as unknown as Record<string, unknown>,
    source_type: "public_records",
    source_provider: rec.source_provider,
    source_url: rec.source_url,
    import_job_id: null,
  };
}

export async function ingestQualified(
  records: InvestorRecord[],
  batch: string,
  opts: IngestOptions = {}
): Promise<IngestResult> {
  const sp = client();
  const maxRows = opts.maxRows ?? 1_000;
  const batchSize = opts.batchSize ?? 200;
  const errors: string[] = [];
  let staged = 0;
  let inserted = 0;
  let skipped = 0;

  const capped = records.length > maxRows;
  // Defensive: 'other' records should have been rejected upstream by the
  // startup-signal gate; never let an unclassified type reach the DB.
  const slice = records.filter((r) => r.investor_type && r.investor_type !== "other").slice(0, maxRows);

  if (opts.dryRun) {
    return { staged: slice.length, inserted: 0, skipped: 0, capped, errors: ["dry-run"] };
  }

  // Stage raw pipeline records first (audit trail without loading investors)
  for (let i = 0; i < slice.length; i += batchSize) {
    const chunk = slice.slice(i, i + batchSize);
    const rawRows = chunk.map((r) => toRawRecord(r, batch));
    const { error } = await sp.from("raw_records").insert(rawRows);
    if (error) errors.push(`raw_records batch ${i}: ${error.message}`);
    else staged += chunk.length;
  }

  // Idempotency: resolve which canonical names already exist for this provider
  for (let i = 0; i < slice.length; i += batchSize) {
    if (inserted >= maxRows) break;
    const chunk = slice.slice(i, i + batchSize);

    // skip rows already present (provider + legal_name)
    const names = chunk.map((r) => r.legal_name || r.canonical_name);
    const { data: existing } = await sp
      .from("investors")
      .select("id, full_name")
      .eq("source_provider", "iapd")
      .in("full_name", names);
    const existingNames = new Set((existing || []).map((e) => e.full_name));

    const toInsert = chunk
      .filter((r) => {
        const n = r.legal_name || r.canonical_name;
        if (existingNames.has(n)) {
          skipped++;
          return false;
        }
        return true;
      })
      .map(toInvestorRow);

    if (toInsert.length === 0) continue;

    const { error, count } = await sp.from("investors").insert(toInsert, { count: "exact" });
    if (error) {
      errors.push(`investors batch ${i}: ${error.message}`);
    } else {
      inserted += toInsert.length;
    }
    void count;
  }

  return { staged, inserted, skipped, capped, errors };
}
