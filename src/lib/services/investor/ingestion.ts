// =============================================
// Investor Ingestion Pipeline
// =============================================
// Takes raw CSV/API data → raw_records → normalized → matched → canonical
// Uses CockroachDB for data.

import { query } from "@/lib/db";
import {
  normalizeInvestor,
  type NormalizedInvestor,
} from "./normalization";
import { findMatchingInvestor } from "./matching";
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
  const staged: string[] = [];
  const BATCH_SIZE = 500;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const valuePlaceholders: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    for (const row of batch) {
      valuePlaceholders.push(
        `($${paramIdx++}::jsonb, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
      );
      params.push(
        JSON.stringify(row),
        "provider",
        source,
        importJobId || null,
        "pending"
      );
    }

    try {
      const rows = await query<{ id: string }>(
        `INSERT INTO raw_records (raw_data, source_type, source_provider, import_job_id, status)
         VALUES ${valuePlaceholders.join(", ")}
         RETURNING id`,
        params
      );
      staged.push(...rows.map((r) => r.id));
    } catch {
      // Continue with other batches
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
  const result: IngestionResult = {
    totalRecords: 0,
    staged: 0,
    matched: 0,
    newRecords: 0,
    duplicates: 0,
    errors: 0,
    errorMessages: [],
  };

  const pendingRecords = await query<any>(
    `SELECT * FROM raw_records WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1`,
    [batchSize]
  );

  result.totalRecords = pendingRecords.length;

  for (const record of pendingRecords) {
    try {
      // Mark as processing
      await query(
        `UPDATE raw_records SET status = 'processing' WHERE id = $1`,
        [record.id]
      );

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
      await query(
        `UPDATE raw_records SET normalized_data = $1::jsonb, parsed_data = $2::jsonb WHERE id = $3`,
        [JSON.stringify(normalized), JSON.stringify(providerResult), record.id]
      );

      // Try to match against existing investors
      const matchResult = await findMatchingInvestor(normalized);

      if (matchResult) {
        if (matchResult.confidence >= 0.95) {
          await query(
            `UPDATE raw_records SET status = 'matched', matched_investor_id = $1, match_confidence = $2, processed_at = NOW() WHERE id = $3`,
            [matchResult.investorId, matchResult.confidence, record.id]
          );
          result.matched++;
        } else if (matchResult.confidence >= 0.70) {
          await query(
            `UPDATE raw_records SET status = 'duplicate', matched_investor_id = $1, match_confidence = $2, processed_at = NOW() WHERE id = $3`,
            [matchResult.investorId, matchResult.confidence, record.id]
          );

          await query(
            `INSERT INTO duplicate_candidates (investor_a_id, investor_b_id, confidence, match_signals, status)
             VALUES ($1, NULL, $2, $3::jsonb, 'pending')`,
            [matchResult.investorId, matchResult.confidence, JSON.stringify(matchResult.signals)]
          );
          result.duplicates++;
        } else {
          await query(
            `UPDATE raw_records SET status = 'new', processed_at = NOW() WHERE id = $1`,
            [record.id]
          );
          result.newRecords++;
        }
      } else {
        await query(
          `UPDATE raw_records SET status = 'new', processed_at = NOW() WHERE id = $1`,
          [record.id]
        );
        result.newRecords++;
      }
    } catch (err) {
      result.errors++;
      result.errorMessages.push(`Record ${record.id}: ${err}`);

      await query(
        `UPDATE raw_records SET status = 'error', error_message = $1, processed_at = NOW() WHERE id = $2`,
        [String(err), record.id]
      );
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
  let promoted = 0;
  let errors = 0;

  const newRecords = await query<any>(
    `SELECT * FROM raw_records WHERE status = 'new' ORDER BY created_at ASC LIMIT $1`,
    [batchSize]
  );

  for (const record of newRecords) {
    try {
      const norm = record.normalized_data as NormalizedInvestor;
      if (!norm || !norm.fullName) continue;

      // Insert as canonical investor
      const rows = await query<{ id: string }>(
        `INSERT INTO investors (full_name, first_name, last_name, email, phone, linkedin_url, job_title, bio, location, country, city, investor_type, investment_stages, investment_sectors, investment_geographies, min_check_size, max_check_size, currency, portfolio_count, website_url, avatar_url, source, source_id, source_provider, data_quality_score, outreach_readiness, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
         RETURNING id`,
        [
          norm.fullName, norm.firstName, norm.lastName, norm.email, norm.phone,
          norm.linkedinUrl, norm.jobTitle, norm.bio, norm.location, norm.country,
          norm.city, norm.investorType, norm.investmentStages, norm.investmentSectors,
          norm.investmentGeographies, norm.minCheckSize, norm.maxCheckSize, norm.currency,
          norm.portfolioCount, norm.websiteUrl, norm.avatarUrl, norm.source, norm.sourceId,
          norm.source, norm.email ? 50 : 20, "not_ready", true,
        ]
      );

      if (!rows.length) throw new Error("Insert failed");

      // Auto-enrich
      try {
        const { enrichInvestor } = await import("./enrichment");
        await enrichInvestor(rows[0].id);
      } catch {
        // Enrichment is non-critical
      }

      // Log creation
      await query(
        `INSERT INTO data_change_log (investor_id, field_name, old_value, new_value, source_type, source_provider, confidence, change_type, detected_by)
         VALUES ($1, '_created', NULL, $2, 'provider', $3, 1.0, 'create', 'ingestion_pipeline')`,
        [rows[0].id, norm.fullName, norm.source]
      );

      // Mark raw record as matched
      await query(
        `UPDATE raw_records SET status = 'matched', matched_investor_id = $1, match_confidence = 1.0 WHERE id = $2`,
        [rows[0].id, record.id]
      );

      promoted++;
    } catch (err) {
      errors++;
      await query(
        `UPDATE raw_records SET status = 'error', error_message = $1 WHERE id = $2`,
        [String(err), record.id]
      );
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
  const rows = parseCsv(csvContent);
  const stagedIds = await stageRecords(rows, source);
  const result = await processRawRecords(stagedIds.length);
  const promoted = await promoteNewRecords(result.newRecords);
  result.matched += promoted.promoted;
  result.errors += promoted.errors;

  return result;
}
