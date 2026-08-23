// =============================================
// Investor Ingestion Pipeline
// =============================================
// Takes raw CSV/API data → raw_records → normalized → matched → canonical

import { createClient } from "@supabase/supabase-js";
import {
  normalizeInvestor,
  generateDeduplicationKeys,
  type NormalizedInvestor,
} from "./normalization";
import { findMatchingInvestor, type MatchResult } from "./matching";
import { mapColumns } from "./columns";

// =============================================
// Types
// =============================================

interface RawRecord {
  raw_data: Record<string, unknown>;
  source_type: string;
  source_provider?: string;
  source_url?: string;
  import_job_id?: string;
}

export interface IngestionResult {
  totalRecords: number;
  staged: number;
  matched: number;
  newRecords: number;
  duplicates: number;
  errors: number;
  errorMessages: string[];
}

// Column mapping imported from shared module

// =============================================
// CSV Parsing
// =============================================

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const columnMap = mapColumns(headers);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};

    for (const [field, csvColumn] of Object.entries(columnMap)) {
      const colIndex = headers.indexOf(csvColumn);
      if (colIndex !== -1 && values[colIndex]) {
        row[field] = values[colIndex];
      }
    }

    if (row.fullName || (row.firstName && row.lastName)) {
      rows.push(row);
    }
  }

  return rows;
}

// =============================================
// Stage 1: Stage raw records into raw_records table
// =============================================

export async function stageRecords(
  records: Record<string, string>[],
  source: string,
  importJobId?: string
): Promise<string[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const staged: string[] = [];
  const BATCH_SIZE = 500;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const insertData = batch.map((row) => ({
      raw_data: row,
      source_type: "provider" as const,
      source_provider: source,
      import_job_id: importJobId || null,
      status: "pending",
    }));

    const { data, error } = await supabase
      .from("raw_records")
      .insert(insertData)
      .select("id");

    if (!error && data) {
      staged.push(...data.map((d) => d.id));
    }
  }

  return staged;
}

// =============================================
// Stage 2: Process a batch of raw records
// =============================================

export async function processRawRecords(
  batchSize = 100
): Promise<IngestionResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result: IngestionResult = {
    totalRecords: 0,
    staged: 0,
    matched: 0,
    newRecords: 0,
    duplicates: 0,
    errors: 0,
    errorMessages: [],
  };

  // Fetch pending records
  const { data: pendingRecords, error: fetchError } = await supabase
    .from("raw_records")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (fetchError || !pendingRecords) {
    result.errorMessages.push(`Failed to fetch pending records: ${fetchError?.message}`);
    return result;
  }

  result.totalRecords = pendingRecords.length;

  for (const record of pendingRecords) {
    try {
      // Mark as processing
      await supabase
        .from("raw_records")
        .update({ status: "processing" })
        .eq("id", record.id);

      // Normalize the raw data
      const raw = record.raw_data as Record<string, string>;
      const providerResult = {
        providerId: raw.sourceId || record.id,
        providerName: record.source_provider || "unknown",
        firstName: raw.firstName,
        lastName: raw.lastName,
        fullName: raw.fullName || `${raw.firstName || ""} ${raw.lastName || ""}`.trim(),
        email: raw.email,
        phone: raw.phone,
        linkedinUrl: raw.linkedinUrl,
        jobTitle: raw.jobTitle,
        bio: raw.bio,
        location: raw.location,
        country: raw.country,
        city: raw.city,
        investorType: raw.investorType,
        firmName: raw.firmName,
        firmDomain: raw.firmDomain,
        firmWebsite: raw.firmWebsite,
        investmentStages: raw.investmentStages ? raw.investmentStages.split(/[;|,]/).map((s: string) => s.trim()) : [],
        investmentSectors: raw.investmentSectors ? raw.investmentSectors.split(/[;|,]/).map((s: string) => s.trim()) : [],
        investmentGeographies: raw.investmentGeographies ? raw.investmentGeographies.split(/[;|,]/).map((s: string) => s.trim()) : [],
        portfolioCount: raw.portfolioCount ? parseInt(raw.portfolioCount) : undefined,
        websiteUrl: raw.websiteUrl,
        avatarUrl: raw.avatarUrl,
        raw: raw,
      };

      const normalized = normalizeInvestor(providerResult);

      // Update raw record with normalized data
      await supabase
        .from("raw_records")
        .update({ normalized_data: normalized, parsed_data: providerResult })
        .eq("id", record.id);

      // Try to match against existing investors
      const matchResult = await findMatchingInvestor(normalized);

      if (matchResult) {
        // Match found
        if (matchResult.confidence >= 0.95) {
          // High confidence — auto-link
          await supabase
            .from("raw_records")
            .update({
              status: "matched",
              matched_investor_id: matchResult.investorId,
              match_confidence: matchResult.confidence,
              processed_at: new Date().toISOString(),
            })
            .eq("id", record.id);
          result.matched++;
        } else if (matchResult.confidence >= 0.70) {
          // Medium confidence — mark as duplicate candidate
          await supabase
            .from("raw_records")
            .update({
              status: "duplicate",
              matched_investor_id: matchResult.investorId,
              match_confidence: matchResult.confidence,
              processed_at: new Date().toISOString(),
            })
            .eq("id", record.id);

          // Create duplicate candidate
          await supabase.from("duplicate_candidates").insert({
            investor_a_id: matchResult.investorId,
            investor_b_id: null, // Will be linked when new record is created
            confidence: matchResult.confidence,
            match_signals: matchResult.signals,
            status: "pending",
          });
          result.duplicates++;
        } else {
          // Low confidence — treat as new
          await supabase
            .from("raw_records")
            .update({ status: "new", processed_at: new Date().toISOString() })
            .eq("id", record.id);
          result.newRecords++;
        }
      } else {
        // No match — new record
        await supabase
          .from("raw_records")
          .update({ status: "new", processed_at: new Date().toISOString() })
          .eq("id", record.id);
        result.newRecords++;
      }
    } catch (err) {
      result.errors++;
      result.errorMessages.push(`Record ${record.id}: ${err}`);

      await supabase
        .from("raw_records")
        .update({
          status: "error",
          error_message: String(err),
          processed_at: new Date().toISOString(),
        })
        .eq("id", record.id);
    }
  }

  return result;
}

// =============================================
// Stage 3: Promote new records to canonical investors
// =============================================

export async function promoteNewRecords(
  batchSize = 100
): Promise<{ promoted: number; errors: number }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let promoted = 0;
  let errors = 0;

  const { data: newRecords } = await supabase
    .from("raw_records")
    .select("*")
    .eq("status", "new")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (!newRecords) return { promoted, errors };

  for (const record of newRecords) {
    try {
      const norm = record.normalized_data as NormalizedInvestor;
      if (!norm || !norm.fullName) continue;

      // Insert as canonical investor
      const { data: investor, error } = await supabase
        .from("investors")
        .insert({
          full_name: norm.fullName,
          first_name: norm.firstName,
          last_name: norm.lastName,
          email: norm.email,
          phone: norm.phone,
          linkedin_url: norm.linkedinUrl,
          job_title: norm.jobTitle,
          bio: norm.bio,
          location: norm.location,
          country: norm.country,
          city: norm.city,
          investor_type: norm.investorType,
          investment_stages: norm.investmentStages,
          investment_sectors: norm.investmentSectors,
          investment_geographies: norm.investmentGeographies,
          min_check_size: norm.minCheckSize,
          max_check_size: norm.maxCheckSize,
          currency: norm.currency,
          portfolio_count: norm.portfolioCount,
          website_url: norm.websiteUrl,
          avatar_url: norm.avatarUrl,
          source: norm.source,
          source_id: norm.sourceId,
          source_provider: norm.source,
          data_quality_score: norm.email ? 50 : 20,
          outreach_readiness: "not_ready",
          is_active: true,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Auto-enrich: compute data quality + outreach readiness + provenance
      try {
        const { enrichInvestor } = await import("./enrichment");
        await enrichInvestor(investor.id);
      } catch {
        // Enrichment is non-critical — don't fail the pipeline
      }

      // Log creation
      await supabase.rpc("log_data_change", {
        p_investor_id: investor.id,
        p_field_name: "_created",
        p_old_value: null,
        p_new_value: norm.fullName,
        p_source_type: "provider",
        p_source_provider: norm.source,
        p_confidence: 1.0,
        p_change_type: "create",
        p_detected_by: "ingestion_pipeline",
      });

      // Mark raw record as matched
      await supabase
        .from("raw_records")
        .update({
          status: "matched",
          matched_investor_id: investor.id,
          match_confidence: 1.0,
        })
        .eq("id", record.id);

      promoted++;
    } catch (err) {
      errors++;
      await supabase
        .from("raw_records")
        .update({ status: "error", error_message: String(err) })
        .eq("id", record.id);
    }
  }

  return { promoted, errors };
}

// =============================================
// Full Pipeline: CSV → Canonical
// =============================================

export async function runFullPipeline(
  csvContent: string,
  source: string = "csv_import"
): Promise<IngestionResult> {
  // 1. Parse CSV
  const rows = parseCsv(csvContent);

  // 2. Stage raw records
  const stagedIds = await stageRecords(rows, source);

  // 3. Process (normalize + match)
  const result = await processRawRecords(stagedIds.length);

  // 4. Promote new records
  const promoted = await promoteNewRecords(result.newRecords);
  result.matched += promoted.promoted;
  result.errors += promoted.errors;

  return result;
}
