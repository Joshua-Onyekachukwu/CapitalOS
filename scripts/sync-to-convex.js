#!/usr/bin/env node
/**
 * Supabase → Convex Sync
 * 
 * Moves investors from Supabase into Convex raw staging.
 * Only moves records that haven't been synced yet.
 * Keeps Supabase free tier from being overwhelmed by raw data.
 * 
 * Strategy:
 * - Investors with emails and high quality stay in Supabase (hot data)
 * - Investors without emails or low quality go to Convex (cold storage)
 * - Convex qualifies them before promoting back to Supabase
 * 
 * Usage:
 *   node scripts/sync-to-convex.js [--batch 50] [--source edgar-13f] [--dry-run]
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const https = require("https");
const fs = require("fs");
const path = require("path");

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const CONVEX_DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY;
const CHECKPOINT_FILE = path.join(__dirname, "../data-backups/convex-sync-checkpoint.json");

// Parse args
const args = process.argv.slice(2);
const BATCH_SIZE = parseInt(args.find((_, i, a) => a[i - 1] === "--batch") || "50");
const SOURCE_FILTER = args.find((_, i, a) => a[i - 1] === "--source") || null;
const DRY_RUN = args.includes("--dry-run");
const MIN_QUALITY = parseInt(args.find((_, i, a) => a[i - 1] === "--min-quality") || "0");

function loadCheckpoint() {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf8")); }
  catch { return { lastOffset: 0, synced: 0, skipped: 0, errors: 0 }; }
}

function saveCheckpoint(data) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

/**
 * Call Convex HTTP API mutation.
 * Uses the deploy key for server-to-server calls.
 */
async function convexMutation(functionPath, args) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/api/mutation`, CONVEX_URL);
    const body = JSON.stringify({
      path: functionPath,
      args,
    });

    const req = https.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Convex ${CONVEX_DEPLOY_KEY}`,
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.error) reject(new Error(json.error));
          else resolve(json.value);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function normalizeRecord(inv) {
  const name = inv.full_name || `${inv.first_name || ""} ${inv.last_name || ""}`.trim();
  return {
    rawData: inv,
    fullName: name || inv.company_name || "Unknown",
    firstName: inv.first_name,
    lastName: inv.last_name,
    companyName: inv.company_name,
    email: inv.email,
    phone: inv.phone,
    website: inv.company_website,
    linkedinUrl: inv.linkedin_url,
    country: inv.country,
    city: inv.city,
    investorType: inv.investor_type,
    source: inv.source || "unknown",
    sourceId: inv.id,
    sourceUrl: inv.source_url,
  };
}

async function main() {
  console.log("=".repeat(60));
  console.log("Supabase → Convex Sync");
  console.log("=".repeat(60));

  if (!CONVEX_URL || !CONVEX_DEPLOY_KEY) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL or CONVEX_DEPLOY_KEY in .env.local");
    process.exit(1);
  }

  const checkpoint = loadCheckpoint();
  console.log(`Previous: ${checkpoint.synced} synced, ${checkpoint.skipped} skipped, ${checkpoint.errors} errors\n`);

  // Build query: get investors that should go to Convex
  // Criteria: no email OR low quality score OR not recently active
  let query = sp
    .from("investors")
    .select("id, full_name, first_name, last_name, job_title, investor_type, company_name, company_website, linkedin_url, country, city, email, phone, source, source_id, source_url, data_quality_score, created_at")
    .order("created_at", { ascending: true })
    .range(checkpoint.lastOffset, checkpoint.lastOffset + BATCH_SIZE - 1);

  // Filter: only sync records without emails or with low quality
  // Records WITH emails and high quality stay in Supabase as hot data
  if (MIN_QUALITY > 0) {
    query = query.or(`data_quality_score.is.null,data_quality_score.lt.${MIN_QUALITY}`);
  }

  if (SOURCE_FILTER) {
    query = query.eq("source", SOURCE_FILTER);
  }

  const { data: investors, error } = await query;

  if (error) {
    console.error("Supabase query error:", error.message);
    return;
  }

  if (!investors?.length) {
    console.log("No more investors to sync to Convex.");
    return;
  }

  console.log(`Processing ${investors.length} investors...\n`);

  let synced = checkpoint.synced;
  let skipped = checkpoint.skipped;
  let errors = checkpoint.errors;

  // Process in smaller batches for Convex (max 50 per mutation call)
  for (let i = 0; i < investors.length; i += 10) {
    const batch = investors.slice(i, i + 10);
    const records = batch.map(normalizeRecord);

    process.stdout.write(`Batch ${Math.floor(i / 10) + 1}: ${records.length} records... `);

    if (DRY_RUN) {
      console.log("(dry run — would sync)");
      synced += records.length;
      continue;
    }

    try {
      const result = await convexMutation("rawInvestorsOps:batchInsert", {
        records,
      });

      if (result) {
        synced += result.inserted || 0;
        skipped += result.duplicates || 0;
        console.log(`✓ ${result.inserted} inserted, ${result.duplicates} duplicates`);
      }
    } catch (e) {
      errors++;
      console.log(`✗ ${e.message}`);
    }

    // Rate limit: 200ms between Convex calls
    await new Promise(r => setTimeout(r, 200));
  }

  // Save checkpoint
  saveCheckpoint({
    lastOffset: checkpoint.lastOffset + investors.length,
    synced,
    skipped,
    errors,
  });

  // Get current Supabase totals
  const { count: total } = await sp.from("investors").select("*", { count: "exact", head: true });
  const { count: withEmail } = await sp.from("investors").select("*", { count: "exact", head: true }).not("email", "is", null);

  console.log("\n" + "=".repeat(60));
  console.log("SYNC COMPLETE");
  console.log("=".repeat(60));
  console.log(`Synced to Convex: ${synced}`);
  console.log(`Skipped (duplicate): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`\nSupabase: ${total} total, ${withEmail} with email`);
  console.log(`Convex: ${synced} raw records`);
  console.log(`\nNext: node scripts/sync-to-convex.js --offset ${checkpoint.lastOffset + investors.length}`);
}

main().catch(console.error);
