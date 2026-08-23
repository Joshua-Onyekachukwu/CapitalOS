// =============================================
// CSV Bulk Import Pipeline
// =============================================
// Parses CSV investor data, normalizes through our pipeline,
// deduplicates, and batch-inserts into CockroachDB.

import { query } from "@/lib/db";
import {
  normalizeInvestor,
  generateDeduplicationKeys,
  type NormalizedInvestor,
} from "./normalization";
import { mapColumns } from "./columns";

// =============================================
// CSV Row Interface
// =============================================

interface CsvRow {
  [key: string]: string;
}

// =============================================
// Import Result
// =============================================

export interface ImportResult {
  totalRows: number;
  parsed: number;
  normalized: number;
  duplicates: number;
  inserted: number;
  failed: number;
  errors: string[];
}

// =============================================
// Parse CSV
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

function parseCsv(content: string): CsvRow[] {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const columnMap = mapColumns(headers);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: CsvRow = {};

    for (const [field, csvColumn] of Object.entries(columnMap)) {
      const colIndex = headers.indexOf(csvColumn);
      if (colIndex !== -1 && values[colIndex]) {
        row[field] = values[colIndex];
      }
    }

    // Only include rows with at least a name
    if (row.fullName || (row.firstName && row.lastName)) {
      rows.push(row);
    }
  }

  return rows;
}

// =============================================
// Convert CSV row to InvestorProviderResult shape
// =============================================

function csvRowToProviderResult(row: CsvRow, source: string) {
  const fullName = row.fullName || `${row.firstName || ""} ${row.lastName || ""}`.trim();
  return {
    providerId: row.sourceId || `csv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    providerName: source,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: fullName || "Unknown",
    email: row.email,
    phone: row.phone,
    linkedinUrl: row.linkedinUrl,
    jobTitle: row.jobTitle,
    bio: row.bio,
    location: row.location,
    country: row.country,
    city: row.city,
    investorType: row.investorType,
    firmName: row.firmName,
    firmDomain: row.firmDomain,
    firmWebsite: row.firmWebsite,
    investmentStages: row.investmentStages ? row.investmentStages.split(/[;|,]/).map((s) => s.trim()) : [],
    investmentSectors: row.investmentSectors ? row.investmentSectors.split(/[;|,]/).map((s) => s.trim()) : [],
    investmentGeographies: row.investmentGeographies ? row.investmentGeographies.split(/[;|,]/).map((s) => s.trim()) : [],
    portfolioCount: row.portfolioCount ? parseInt(row.portfolioCount) : undefined,
    websiteUrl: row.websiteUrl,
    avatarUrl: row.avatarUrl,
    raw: row,
  };
}

// =============================================
// Main Import Function
// =============================================

export async function importCsvToSupabase(
  csvContent: string,
  source: string = "csv_import"
): Promise<ImportResult> {
  const result: ImportResult = {
    totalRows: 0,
    parsed: 0,
    normalized: 0,
    duplicates: 0,
    inserted: 0,
    failed: 0,
    errors: [],
  };

  try {
    // 1. Parse CSV
    const rows = parseCsv(csvContent);
    result.totalRows = rows.length;
    result.parsed = rows.length;

    if (rows.length === 0) {
      result.errors.push("No valid rows found in CSV");
      return result;
    }

    // 2. Normalize each row
    const normalized: NormalizedInvestor[] = [];
    for (const row of rows) {
      try {
        const providerResult = csvRowToProviderResult(row, source);
        const norm = normalizeInvestor(providerResult);
        normalized.push(norm);
      } catch (err) {
        result.failed++;
        result.errors.push(`Row parse error: ${err}`);
      }
    }
    result.normalized = normalized.length;

    // 3. Deduplicate against existing data
    const csvEmails = normalized
      .map((inv) => inv.email?.toLowerCase().trim())
      .filter((e): e is string => !!e);
    const csvLinkedins = normalized
      .map((inv) => inv.linkedinUrl?.toLowerCase().trim().replace(/\/+$/, ""))
      .filter((l): l is string => !!l);

    const existingEmails = new Set<string>();
    const existingLinkedins = new Set<string>();

    // Batch query emails from CockroachDB
    for (let i = 0; i < csvEmails.length; i += 100) {
      const batch = csvEmails.slice(i, i + 100);
      const placeholders = batch.map((_, j) => `$${j + 1}`).join(", ");
      const data = await query<{ email: string }>(
        `SELECT email FROM investors WHERE email IN (${placeholders})`,
        batch
      );
      data.forEach((inv) => {
        if (inv.email) existingEmails.add(inv.email.toLowerCase());
      });
    }

    // Batch query linkedins from CockroachDB
    for (let i = 0; i < csvLinkedins.length; i += 100) {
      const batch = csvLinkedins.slice(i, i + 100);
      const placeholders = batch.map((_, j) => `$${j + 1}`).join(", ");
      const data = await query<{ linkedin_url: string }>(
        `SELECT linkedin_url FROM investors WHERE linkedin_url IN (${placeholders})`,
        batch
      );
      data.forEach((inv) => {
        if (inv.linkedin_url) existingLinkedins.add(inv.linkedin_url.toLowerCase().replace(/\/+$/, ""));
      });
    }

    // Filter duplicates
    const unique: NormalizedInvestor[] = [];
    for (const inv of normalized) {
      const dedupKeys = generateDeduplicationKeys(inv);
      const isDuplicate = dedupKeys.some((key) => {
        if (key.startsWith("email:")) return existingEmails.has(key.replace("email:", ""));
        if (key.startsWith("linkedin:")) return existingLinkedins.has(key.replace("linkedin:", ""));
        return false;
      });

      if (isDuplicate) {
        result.duplicates++;
      } else {
        unique.push(inv);
        if (inv.email) existingEmails.add(inv.email.toLowerCase());
        if (inv.linkedinUrl) existingLinkedins.add(inv.linkedinUrl.toLowerCase().replace(/\/+$/, ""));
      }
    }

    // 4. Batch insert into CockroachDB (500 at a time)
    const BATCH_SIZE = 500;
    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      const batch = unique.slice(i, i + BATCH_SIZE);

      // Build multi-row INSERT
      const valuePlaceholders: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      for (const inv of batch) {
        const rowPlaceholders = [
          `$${paramIdx++}`, // full_name
          `$${paramIdx++}`, // first_name
          `$${paramIdx++}`, // last_name
          `$${paramIdx++}`, // email
          `$${paramIdx++}`, // phone
          `$${paramIdx++}`, // linkedin_url
          `$${paramIdx++}`, // job_title
          `$${paramIdx++}`, // bio
          `$${paramIdx++}`, // location
          `$${paramIdx++}`, // country
          `$${paramIdx++}`, // city
          `$${paramIdx++}`, // investor_type
          `$${paramIdx++}::text[]`, // investment_stages
          `$${paramIdx++}::text[]`, // investment_sectors
          `$${paramIdx++}::text[]`, // investment_geographies
          `$${paramIdx++}`, // min_check_size
          `$${paramIdx++}`, // max_check_size
          `$${paramIdx++}`, // currency
          `$${paramIdx++}`, // portfolio_count
          `$${paramIdx++}`, // website_url
          `$${paramIdx++}`, // avatar_url
          `$${paramIdx++}`, // source
          `$${paramIdx++}`, // source_id
          `$${paramIdx++}`, // source_provider
          `$${paramIdx++}`, // data_quality_score
          `$${paramIdx++}`, // outreach_readiness
          `$${paramIdx++}`, // is_active
        ];

        valuePlaceholders.push(`(${rowPlaceholders.join(", ")})`);

        params.push(
          inv.fullName,
          inv.firstName,
          inv.lastName,
          inv.email,
          inv.phone,
          inv.linkedinUrl,
          inv.jobTitle,
          inv.bio,
          inv.location,
          inv.country,
          inv.city,
          inv.investorType,
          inv.investmentStages,
          inv.investmentSectors,
          inv.investmentGeographies,
          inv.minCheckSize,
          inv.maxCheckSize,
          inv.currency,
          inv.portfolioCount,
          inv.websiteUrl,
          inv.avatarUrl,
          inv.source,
          inv.sourceId,
          inv.source,
          inv.email ? 50 : 20,
          "not_ready",
          true
        );
      }

      try {
        await query(
          `INSERT INTO investors (full_name, first_name, last_name, email, phone, linkedin_url, job_title, bio, location, country, city, investor_type, investment_stages, investment_sectors, investment_geographies, min_check_size, max_check_size, currency, portfolio_count, website_url, avatar_url, source, source_id, source_provider, data_quality_score, outreach_readiness, is_active)
           VALUES ${valuePlaceholders.join(", ")}`,
          params
        );
        result.inserted += batch.length;
      } catch (err: any) {
        result.errors.push(`Batch insert error: ${err.message}`);
        result.failed += batch.length;
      }
    }

    return result;
  } catch (err) {
    result.errors.push(`Import failed: ${err}`);
    return result;
  }
}

// =============================================
// File-based import (for admin scripts)
// =============================================

export async function importCsvFile(filePath: string): Promise<ImportResult> {
  const { readFileSync } = await import("fs");
  const content = readFileSync(filePath, "utf-8");
  return importCsvToSupabase(content, "csv_import");
}
