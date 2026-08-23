// =============================================
// CSV Bulk Import Pipeline
// =============================================
// Parses CSV investor data, normalizes through our pipeline,
// deduplicates, and batch-inserts into Supabase.

import { createClient } from "@supabase/supabase-js";
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

// Column mapping imported from shared module

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

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
    // Collect all emails and linkedins from the CSV for targeted lookup
    const csvEmails = normalized
      .map((inv) => inv.email?.toLowerCase().trim())
      .filter((e): e is string => !!e);
    const csvLinkedins = normalized
      .map((inv) => inv.linkedinUrl?.toLowerCase().trim().replace(/\/+$/, ""))
      .filter((l): l is string => !!l);

    // Targeted lookup — check for specific emails/linkedins in batches of 100
    const existingEmails = new Set<string>();
    const existingLinkedins = new Set<string>();

    // Batch query emails (Supabase in-queries max ~100 per call)
    for (let i = 0; i < csvEmails.length; i += 100) {
      const batch = csvEmails.slice(i, i + 100);
      const { data } = await supabase
        .from("investors")
        .select("email")
        .in("email", batch);
      (data || []).forEach((inv) => {
        if (inv.email) existingEmails.add(inv.email.toLowerCase());
      });
    }

    // Batch query linkedins
    for (let i = 0; i < csvLinkedins.length; i += 100) {
      const batch = csvLinkedins.slice(i, i + 100);
      const { data } = await supabase
        .from("investors")
        .select("linkedin_url")
        .in("linkedin_url", batch);
      (data || []).forEach((inv) => {
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
        // Add to set to catch intra-batch duplicates
        if (inv.email) existingEmails.add(inv.email.toLowerCase());
        if (inv.linkedinUrl) existingLinkedins.add(inv.linkedinUrl.toLowerCase().replace(/\/+$/, ""));
      }
    }

    // 4. Batch insert into Supabase (500 at a time)
    const BATCH_SIZE = 500;
    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      const batch = unique.slice(i, i + BATCH_SIZE);

      const insertData = batch.map((inv) => ({
        full_name: inv.fullName,
        first_name: inv.firstName,
        last_name: inv.lastName,
        email: inv.email,
        phone: inv.phone,
        linkedin_url: inv.linkedinUrl,
        job_title: inv.jobTitle,
        bio: inv.bio,
        location: inv.location,
        country: inv.country,
        city: inv.city,
        investor_type: inv.investorType,
        investment_stages: inv.investmentStages,
        investment_sectors: inv.investmentSectors,
        investment_geographies: inv.investmentGeographies,
        min_check_size: inv.minCheckSize,
        max_check_size: inv.maxCheckSize,
        currency: inv.currency,
        portfolio_count: inv.portfolioCount,
        website_url: inv.websiteUrl,
        avatar_url: inv.avatarUrl,
        source: inv.source,
        source_id: inv.sourceId,
        source_provider: inv.source,
        data_quality_score: inv.email ? 50 : 20,
        outreach_readiness: "not_ready",
        is_active: true,
      }));

      const { error, data } = await supabase
        .from("investors")
        .insert(insertData)
        .select("id");

      if (error) {
        result.errors.push(`Batch insert error: ${error.message}`);
        result.failed += batch.length;
      } else {
        result.inserted += (data?.length || batch.length);
      }
    }

    // 5. Post-import enrichment — enrich the records we just inserted
    if (result.inserted > 0) {
      try {
        const { enrichInvestor } = await import("./enrichment");
        // Enrich the latest batch of inserted records
        const { data: latestRecords } = await supabase
          .from("investors")
          .select("id")
          .eq("source_provider", source)
          .is("last_enriched_at", null)
          .order("created_at", { ascending: false })
          .limit(Math.min(result.inserted, 200));

        if (latestRecords) {
          let enriched = 0;
          for (const rec of latestRecords) {
            try {
              await enrichInvestor(rec.id);
              enriched++;
            } catch {
              // Non-critical
            }
          }
          if (enriched > 0) {
            result.errors.push(`Enriched ${enriched} records`);
          }
        }
      } catch {
        // Non-critical — enrichment can be run separately
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
