#!/usr/bin/env node
/**
 * Import OpenVC / Alternative Source Investors into Supabase
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RESULTS_FILE = path.join(__dirname, "../data-backups/openvc-results.json");

async function main() {
  if (!fs.existsSync(RESULTS_FILE)) {
    console.log("No results file found. Run scrape-openvc.js first.");
    return;
  }

  const results = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
  console.log(`Importing ${results.length} investor profiles...\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const BATCH = 50;

  for (let i = 0; i < results.length; i += BATCH) {
    const batch = results.slice(i, i + BATCH);
    
    // Deduplicate by email
    const emails = batch.filter(r => r.email).map(r => r.email);
    let existingEmails = new Set();
    
    if (emails.length > 0) {
      const { data } = await sp.from("investors").select("email").in("email", emails);
      data?.forEach(e => existingEmails.add(e.email));
    }

    // Also check by company name + type
    const companyNames = batch.map(r => r.companyName).filter(Boolean);
    let existingCompanies = new Set();
    
    if (companyNames.length > 0) {
      const { data } = await sp.from("investors").select("company_name")
        .in("company_name", companyNames)
        .eq("investor_type", "VC Firm");
      data?.forEach(e => existingCompanies.add(e.company_name));
    }

    const toInsert = batch.filter(r => {
      if (r.email && existingEmails.has(r.email)) return false;
      if (!r.email && existingCompanies.has(r.companyName)) return false;
      return true;
    }).map(r => ({
      full_name: r.fullName,
      first_name: r.firstName,
      last_name: r.lastName,
      job_title: r.jobTitle,
      company_name: r.companyName,
      email: r.email,
      email_source: r.email ? "openvc" : null,
      email_verification_status: r.email ? "unverified" : null,
      company_website: r.website,
      linkedin_url: r.linkedinUrl,
      country: r.country,
      city: r.city,
      investor_type: r.investorType || "VC Firm",
      source: r.source,
      source_id: r.sourceId,
      source_url: r.sourceUrl,
      data_quality_score: r.email ? 50 : 30,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    if (toInsert.length > 0) {
      const { error } = await sp.from("investors").insert(toInsert);
      if (error) {
        errors++;
        console.error(`Batch error:`, error.message?.substring(0, 100));
      } else {
        inserted += toInsert.length;
      }
    }

    skipped += batch.length - toInsert.length;
    process.stdout.write(`\rProcessed ${Math.min(i + BATCH, results.length)}/${results.length} | Inserted: ${inserted} | Skipped: ${skipped}`);
  }

  // Get final counts
  const { count: total } = await sp.from("investors").select("*", { count: "exact", head: true });
  const { count: withEmail } = await sp.from("investors").select("*", { count: "exact", head: true }).not("email", "is", null);
  const { count: verified } = await sp.from("investors").select("*", { count: "exact", head: true }).eq("email_verification_status", "verified");

  console.log("\n\n" + "=".repeat(50));
  console.log("IMPORT COMPLETE");
  console.log("=".repeat(50));
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (duplicate): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`\nDatabase totals:`);
  console.log(`Total investors: ${total}`);
  console.log(`With email: ${withEmail}`);
  console.log(`Verified emails: ${verified}`);
}

main().catch(console.error);
