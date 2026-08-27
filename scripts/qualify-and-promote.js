#!/usr/bin/env node
/**
 * Qualification Pipeline — Convex → Supabase
 * 
 * Takes raw investors from Convex, scores them, and promotes
 * the best ones to Supabase hot data.
 * 
 * Qualification Rules:
 * 1. Must have a name (not just a company name)
 * 2. Must have at least one of: email, LinkedIn, website
 * 3. Must not be a duplicate
 * 4. Score >= 50 to be promoted
 * 
 * Scoring:
 * - Has email: +30
 * - Has LinkedIn: +15
 * - Has company name: +10
 * - Has location: +10
 * - Has website: +10
 * - Has job title: +10
 * - Has phone: +5
 * - Email verified: +10
 * 
 * Usage:
 *   node scripts/qualify-and-promote.js [--batch 100] [--min-score 50] [--dry-run]
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
const CHECKPOINT_FILE = path.join(__dirname, "../data-backups/qualify-checkpoint.json");

const args = process.argv.slice(2);
const BATCH_SIZE = parseInt(args.find((_, i, a) => a[i - 1] === "--batch") || "100");
const MIN_SCORE = parseInt(args.find((_, i, a) => a[i - 1] === "--min-score") || "50");
const DRY_RUN = args.includes("--dry-run");

function loadCheckpoint() {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf8")); }
  catch { return { qualified: 0, promoted: 0, rejected: 0, errors: 0 }; }
}

function saveCheckpoint(data) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

async function convexQuery(functionPath, args) {
  return new Promise((resolve, reject) => {
    const url = new URL("/api/query", CONVEX_URL);
    const body = JSON.stringify({ path: functionPath, args: args || {} });
    const req = https.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Convex ${CONVEX_DEPLOY_KEY}`,
      },
    }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        try { const j = JSON.parse(data); if (j.status === 'error' || j.error) { reject(new Error(j.errorMessage || j.error || JSON.stringify(j))); } else { resolve(j.value); } }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function convexMutation(functionPath, args) {
  return new Promise((resolve, reject) => {
    const url = new URL("/api/mutation", CONVEX_URL);
    const body = JSON.stringify({ path: functionPath, args });
    const req = https.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Convex ${CONVEX_DEPLOY_KEY}`,
      },
    }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        try { const j = JSON.parse(data); if (j.status === 'error' || j.error) { reject(new Error(j.errorMessage || j.error || JSON.stringify(j))); } else { resolve(j.value); } }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function scoreRecord(record) {
  let score = 0;
  if (record.email) score += 30;
  if (record.linkedinUrl) score += 15;
  if (record.companyName) score += 10;
  if (record.country || record.city) score += 10;
  if (record.website) score += 10;
  if (record.rawData?.job_title) score += 10;
  if (record.rawData?.phone) score += 5;
  if (record.emailVerified) score += 10;
  return score;
}

function qualifies(record, minScore) {
  // Must have a real name (not just company)
  if (!record.firstName && !record.lastName) return false;
  // Must have at least one contact method
  if (!record.email && !record.linkedinUrl && !record.website) return false;
  // Must not be a duplicate
  if (record.isDuplicate) return false;
  // Must meet minimum score
  return scoreRecord(record) >= minScore;
}

async function promoteToSupabase(record) {
  const name = record.fullName || `${record.firstName || ""} ${record.lastName || ""}`.trim();

  const insertData = {
    full_name: name,
    first_name: record.firstName,
    last_name: record.lastName,
    job_title: record.rawData?.job_title,
    company_name: record.companyName,
    email: record.email,
    email_source: record.emailSource,
    email_verification_status: record.emailConfidence || (record.emailVerified ? "verified" : "inferred"),
    company_website: record.website,
    linkedin_url: record.linkedinUrl,
    country: record.country,
    city: record.city,
    investor_type: record.investorType || "Unknown",
    source: `convex-${record.source}`,
    source_id: record.sourceId,
    source_url: record.sourceUrl,
    phone: record.phone,
    data_quality_score: scoreRecord(record),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await sp.from("investors").insert(insertData).select("id").single();

  if (error) throw error;
  return data.id;
}

async function main() {
  console.log("=".repeat(60));
  console.log("Qualification Pipeline — Convex → Supabase");
  console.log("=".repeat(60));
  console.log(`Min score: ${MIN_SCORE}, Batch: ${BATCH_SIZE}\n`);

  if (!CONVEX_URL || !CONVEX_DEPLOY_KEY) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL or CONVEX_DEPLOY_KEY in .env.local");
    process.exit(1);
  }

  const checkpoint = loadCheckpoint();
  console.log(`Previous: ${checkpoint.qualified} qualified, ${checkpoint.promoted} promoted, ${checkpoint.rejected} rejected\n`);

  // Get scraped records from Convex
  let records;
  try {
    records = await convexQuery("rawInvestorsOps:pendingProcessing", {
      limit: BATCH_SIZE,
    });
  } catch (e) {
    console.error("Failed to query Convex:", e.message);
    return;
  }

  if (!records?.length) {
    console.log("No more records to process.");
    return;
  }

  console.log(`Processing ${records.length} records...\n`);

  let qualified = checkpoint.qualified;
  let promoted = checkpoint.promoted;
  let rejected = checkpoint.rejected;
  let errors = checkpoint.errors;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    process.stdout.write(`[${i + 1}/${records.length}] ${record.fullName?.substring(0, 35)}... `);

    const score = scoreRecord(record);

    if (DRY_RUN) {
      if (qualifies(record, MIN_SCORE)) {
        qualified++;
        console.log(`✓ score ${score} → would promote`);
      } else {
        rejected++;
        console.log(`✗ score ${score} → would reject`);
      }
      continue;
    }

    try {
      if (qualifies(record, MIN_SCORE)) {
        // Mark as qualified in Convex
        await convexMutation("rawInvestorsOps:markQualified", {
          id: record._id,
          score,
          notes: `Score: email=${record.email ? 30 : 0} linkedin=${record.linkedinUrl ? 15 : 0} company=${record.companyName ? 10 : 0} location=${record.country ? 10 : 0} website=${record.website ? 10 : 0}`,
        });

        // Promote to Supabase
        const supabaseId = await promoteToSupabase(record);

        // Mark as promoted in Convex
        await convexMutation("rawInvestorsOps:markPromoted", {
          id: record._id,
          supabaseId,
        });

        qualified++;
        promoted++;
        console.log(`✓ score ${score} → promoted`);
      } else {
        // Mark as rejected in Convex
        await convexMutation("rawInvestorsOps:markRejected", {
          id: record._id,
          reason: `Score ${score} below threshold ${MIN_SCORE}`,
        });

        rejected++;
        console.log(`✗ score ${score} → rejected`);
      }
    } catch (e) {
      errors++;
      console.log(`✗ error: ${e.message?.substring(0, 60)}`);
    }

    // Rate limit: 300ms between Convex calls
    await new Promise(r => setTimeout(r, 300));
  }

  // Save checkpoint
  saveCheckpoint({ qualified, promoted, rejected, errors });

  // Get final counts
  const { count: total } = await sp.from("investors").select("*", { count: "exact", head: true });

  console.log("\n" + "=".repeat(60));
  console.log("QUALIFICATION COMPLETE");
  console.log("=".repeat(60));
  console.log(`Qualified: ${qualified}`);
  console.log(`Promoted to Supabase: ${promoted}`);
  console.log(`Rejected: ${rejected}`);
  console.log(`Errors: ${errors}`);
  console.log(`\nSupabase total: ${total}`);
  console.log(`\nNext batch: node scripts/qualify-and-promote.js`);
}

main().catch(console.error);
