// Import Apollo CSV through the full pipeline
import { readFileSync } from "fs";
import { resolve } from "path";
import { query, closePool } from "./db";
import { normalizeInvestor, type NormalizedInvestor } from "../lib/services/investor/normalization";
import { enrichInvestor } from "../lib/services/investor/enrichment";

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
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

async function main() {
  const csvPath = resolve(__dirname, "../../test-data/apollo-investor-export.csv");
  const content = readFileSync(csvPath, "utf-8");

  const lines = content.split("\n").filter((l) => l.trim());
  const headers = parseCsvLine(lines[0]);

  console.log(`=== Apollo CSV Import ===`);
  console.log(`File: ${csvPath}`);
  console.log(`Rows: ${lines.length - 1}`);
  console.log(`Headers: ${headers.join(", ")}`);
  console.log("");

  // Fetch existing emails for dedup
  const existing = await query<{ email: string }>(
    `SELECT email FROM investors WHERE email IS NOT NULL LIMIT 50000`
  );

  const existingEmails = new Set(
    existing.map((inv) => inv.email?.toLowerCase()).filter(Boolean)
  );

  let inserted = 0;
  let duplicates = 0;
  let errors = 0;
  const insertedIds: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < 3) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ""; });

    const fullName = row.full_name || `${row.first_name} ${row.last_name}`.trim();
    const email = row.email?.toLowerCase().trim();

    if (!fullName || fullName.length < 3) { errors++; continue; }

    // Check email dedup
    if (email && existingEmails.has(email)) {
      duplicates++;
      continue;
    }

    // Normalize
    try {
      const providerResult = {
        providerId: row.source_id || `csv-${i}`,
        providerName: "apollo_csv_import",
        firstName: row.first_name,
        lastName: row.last_name,
        fullName,
        email: row.email || undefined,
        phone: row.phone || undefined,
        linkedinUrl: row.linkedin_url || undefined,
        jobTitle: row.job_title || undefined,
        bio: row.bio || undefined,
        location: row.location || undefined,
        country: row.country || undefined,
        city: row.city || undefined,
        investorType: row.investor_type || "venture_capital",
        firmName: row.firm_name || undefined,
        firmDomain: row.firm_domain || undefined,
        firmWebsite: row.firm_website || undefined,
        investmentStages: row.investment_stages ? row.investment_stages.split(/[;|,]/).map((s) => s.trim()) : [],
        investmentSectors: row.investment_sectors ? row.investment_sectors.split(/[;|,]/).map((s) => s.trim()) : [],
        investmentGeographies: row.investment_geographies ? row.investment_geographies.split(/[;|,]/).map((s) => s.trim()) : [],
        portfolioCount: row.portfolio_count ? parseInt(row.portfolio_count) : undefined,
        websiteUrl: row.website_url || undefined,
        avatarUrl: row.avatar_url || undefined,
        raw: row,
      };

      const norm = normalizeInvestor(providerResult);

      // Insert into investors
      const investors = await query<{ id: string }>(
        `INSERT INTO investors (
          full_name, first_name, last_name, email, phone, linkedin_url, job_title, bio,
          location, country, city, investor_type, investment_stages, investment_sectors,
          investment_geographies, min_check_size, max_check_size, currency, portfolio_count,
          website_url, avatar_url, source, source_id, source_provider,
          data_quality_score, outreach_readiness, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24,
          $25, $26, $27
        ) RETURNING id`,
        [
          norm.fullName, norm.firstName, norm.lastName, norm.email || null, norm.phone || null,
          norm.linkedinUrl || null, norm.jobTitle || null, norm.bio || null,
          norm.location || null, norm.country || null, norm.city || null, norm.investorType,
          norm.investmentStages || [], norm.investmentSectors || [], norm.investmentGeographies || [],
          norm.minCheckSize || null, norm.maxCheckSize || null, norm.currency || "USD",
          norm.portfolioCount || 0, norm.websiteUrl || null, norm.avatarUrl || null,
          "apollo_csv_import", norm.sourceId, "apollo_csv_import",
          0, "not_ready", true,
        ]
      );

      if (investors.length === 0) {
        errors++;
        if (i <= 5) console.log(`  Row ${i} error: no ID returned`);
        continue;
      }

      inserted++;
      insertedIds.push(investors[0].id);
      if (email) existingEmails.add(email);

      // Auto-enrich
      try {
        await enrichInvestor(investors[0].id);
      } catch {
        // Non-critical
      }

    } catch (err) {
      errors++;
      if (i <= 5) console.log(`  Row ${i} error: ${err}`);
    }
  }

  console.log("=== Results ===");
  console.log(`Inserted: ${inserted}`);
  console.log(`Duplicates: ${duplicates}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total processed: ${lines.length - 1}`);

  // Summary of what was imported
  if (insertedIds.length > 0) {
    const imported = await query<{ investor_type: string; country: string; data_quality_score: number; outreach_readiness: string }>(
      `SELECT investor_type, country, data_quality_score, outreach_readiness FROM investors WHERE id = ANY($1)`,
      [insertedIds]
    );

    if (imported.length > 0) {
      const types: Record<string, number> = {};
      const countries: Record<string, number> = {};
      let avgQuality = 0;
      const readiness: Record<string, number> = {};

      imported.forEach((inv) => {
        types[inv.investor_type] = (types[inv.investor_type] || 0) + 1;
        countries[inv.country || "Unknown"] = (countries[inv.country || "Unknown"] || 0) + 1;
        avgQuality += inv.data_quality_score || 0;
        readiness[inv.outreach_readiness] = (readiness[inv.outreach_readiness] || 0) + 1;
      });

      console.log("");
      console.log("=== Import Profile ===");
      console.log("By type:", Object.entries(types).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", "));
      console.log("By country:", Object.entries(countries).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(", "));
      console.log("Avg quality:", Math.round(avgQuality / imported.length));
      console.log("Readiness:", Object.entries(readiness).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", "));
    }
  }

  await closePool();
}

main().catch(console.error);
