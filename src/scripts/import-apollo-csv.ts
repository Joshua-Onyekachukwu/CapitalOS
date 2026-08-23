// Import Apollo CSV through the full pipeline
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
config({ path: resolve(__dirname, "../../.env.local") });

import { createClient } from "@supabase/supabase-js";
import { normalizeInvestor, type NormalizedInvestor } from "../lib/services/investor/normalization";
import { enrichInvestor } from "../lib/services/investor/enrichment";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  const { data: existing } = await supabase
    .from("investors")
    .select("email")
    .not("email", "is", null)
    .limit(50000);

  const existingEmails = new Set(
    (existing || []).map((inv) => inv.email?.toLowerCase()).filter(Boolean)
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
          source: "apollo_csv_import",
          source_id: norm.sourceId,
          source_provider: "apollo_csv_import",
          data_quality_score: 0, // Will be enriched
          outreach_readiness: "not_ready",
          is_active: true,
        })
        .select("id")
        .single();

      if (error) {
        errors++;
        if (i <= 5) console.log(`  Row ${i} error: ${error.message}`);
        continue;
      }

      inserted++;
      insertedIds.push(investor.id);
      if (email) existingEmails.add(email);

      // Auto-enrich
      try {
        await enrichInvestor(investor.id);
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
    const { data: imported } = await supabase
      .from("investors")
      .select("investor_type, country, data_quality_score, outreach_readiness")
      .in("id", insertedIds);

    if (imported) {
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
}

main().catch(console.error);
