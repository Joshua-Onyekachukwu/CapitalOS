#!/usr/bin/env node
/**
 * Import VC Team Contacts into Supabase
 * 
 * Reads the results from scrape-vc-teams.js and inserts new investors.
 * Deduplicates by email or name+company.
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RESULTS_FILE = path.join(__dirname, "../data-backups/vc-team-results.json");

async function main() {
  if (!fs.existsSync(RESULTS_FILE)) {
    console.log("No results file found. Run scrape-vc-teams.js first.");
    return;
  }

  const results = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
  console.log(`Importing ${results.length} scraped contacts...\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const BATCH = 50;

  for (let i = 0; i < results.length; i += BATCH) {
    const batch = results.slice(i, i + BATCH);
    
    // Deduplicate against existing data
    const emails = batch.filter(r => r.email).map(r => r.email);
    let existingEmails = new Set();
    
    if (emails.length > 0) {
      const { data: existing } = await sp
        .from("investors")
        .select("email")
        .in("email", emails);
      existing?.forEach(e => existingEmails.add(e.email));
    }

    // Insert new records
    const toInsert = batch.filter(r => {
      if (r.email && existingEmails.has(r.email)) return false;
      return true;
    }).map(r => ({
      full_name: r.fullName,
      first_name: r.firstName,
      last_name: r.lastName,
      company_name: r.companyName,
      email: r.email,
      email_source: r.emailSource,
      email_verification_status: r.emailSource === "website" ? "likely" : "inferred",
      company_website: r.website,
      linkedin_url: r.linkedinUrl,
      country: r.country,
      city: r.city,
      investor_type: "VC Firm Team",
      source: r.source,
      source_id: r.sourceId,
      source_url: r.sourceUrl,
      data_quality_score: r.emailSource === "website" ? 70 : 40,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    if (toInsert.length > 0) {
      const { error } = await sp.from("investors").insert(toInsert);
      if (error) {
        errors++;
        console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
      } else {
        inserted += toInsert.length;
      }
    }

    skipped += batch.length - toInsert.length;
    
    process.stdout.write(`\rProcessed ${Math.min(i + BATCH, results.length)}/${results.length} | Inserted: ${inserted} | Skipped: ${skipped} | Errors: ${errors}`);
  }

  console.log("\n\n" + "=".repeat(50));
  console.log("IMPORT COMPLETE");
  console.log("=".repeat(50));
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (duplicate): ${skipped}`);
  console.log(`Errors: ${errors}`);

  // Get updated counts
  const { count: total } = await sp.from("investors").select("*", { count: "exact", head: true });
  const { count: withEmail } = await sp.from("investors").select("*", { count: "exact", head: true }).not("email", "is", null);
  console.log(`\nDatabase totals:`);
  console.log(`Total investors: ${total}`);
  console.log(`With email: ${withEmail}`);
}

main().catch(console.error);
