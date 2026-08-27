#!/usr/bin/env node
/**
 * Import Raw Investors to Convex
 * 
 * Moves investors from Supabase that are NOT yet qualified into
 * the Convex raw investors staging table.
 * This keeps Supabase free tier from being overwhelmed.
 * 
 * Strategy:
 * - Investors with low data quality scores stay in Convex
 * - Only high-quality, enriched investors go to Supabase
 * 
 * Usage:
 *   node scripts/import-to-convex.js [--batch 200] [--source edgar-13f]
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--batch") || "200");
const SOURCE_FILTER = process.argv.find((_, i, a) => a[i - 1] === "--source") || null;

// Note: Convex HTTP API requires authentication
// This script uses the Convex HTTP API for mutations
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

async function main() {
  console.log("=".repeat(60));
  console.log("Import Raw Investors to Convex");
  console.log("=".repeat(60));

  if (!CONVEX_URL) {
    console.log("NEXT_PUBLIC_CONVEX_URL not set. Skipping Convex import.");
    console.log("Data will remain in Supabase.");
    return;
  }

  // Get investors that should be moved to Convex (low quality, not enriched)
  let query = sp
    .from("investors")
    .select("id, full_name, first_name, last_name, company_name, email, company_website, linkedin_url, country, city, investor_type, source, source_id, source_url, data_quality_score, created_at, updated_at")
    .or("data_quality_score.is.null,data_quality_score.lt.50")
    .is("email", null)
    .limit(BATCH_SIZE);

  if (SOURCE_FILTER) {
    query = query.eq("source", SOURCE_FILTER);
  }

  const { data: investors, error } = await query;

  if (error) {
    console.error("Query error:", error.message);
    return;
  }

  if (!investors?.length) {
    console.log("No investors to move to Convex.");
    return;
  }

  console.log(`Found ${investors.length} low-quality investors to move to Convex.\n`);

  // Prepare records for Convex
  const now = Date.now();
  const records = investors.map(inv => ({
    rawData: inv,
    fullName: inv.full_name || `${inv.first_name || ""} ${inv.last_name || ""}`.trim() || inv.company_name || "Unknown",
    firstName: inv.first_name,
    lastName: inv.last_name,
    companyName: inv.company_name,
    email: inv.email,
    phone: null,
    website: inv.company_website,
    linkedinUrl: inv.linkedin_url,
    country: inv.country,
    city: inv.city,
    investorType: inv.investor_type,
    source: inv.source || "unknown",
    sourceId: inv.id,
    sourceUrl: inv.source_url,
    scrapedAt: new Date(inv.created_at).getTime() || now,
    status: "scraped",
    dedupeKey: inv.email
      ? inv.email.toLowerCase()
      : `${inv.full_name || ""}|${inv.company_name || ""}`.toLowerCase(),
    isDuplicate: false,
    emailInferred: false,
    emailVerified: false,
    syncedToSupabase: true, // They're already in Supabase
    supabaseId: inv.id,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  }));

  // Save to local JSON for Convex batch import
  const outputFile = path.join(__dirname, `../data-backups/convex-raw-import-${Date.now()}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(records, null, 2));

  console.log(`Saved ${records.length} records to: ${outputFile}`);
  console.log(`\nTo import into Convex, run:`);
  console.log(`  npx convex import rawInvestors --file ${outputFile}`);
  console.log(`\nOr use the Convex dashboard to import.`);

  // Get current totals
  const { count: total } = await sp.from("investors").select("*", { count: "exact", head: true });
  const { count: lowQuality } = await sp.from("investors").select("*", { count: "exact", head: true })
    .or("data_quality_score.is.null,data_quality_score.lt.50")
    .is("email", null);
  const { count: highQuality } = await sp.from("investors").select("*", { count: "exact", head: true })
    .gte("data_quality_score", 50);

  console.log(`\nDatabase breakdown:`);
  console.log(`Total: ${total}`);
  console.log(`Low quality (Convex candidates): ${lowQuality}`);
  console.log(`High quality (Supabase keepers): ${highQuality}`);
}

main().catch(console.error);
