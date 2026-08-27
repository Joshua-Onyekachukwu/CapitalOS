#!/usr/bin/env node
/**
 * Convex Pipeline Status
 * 
 * Shows the current state of the raw investor staging pipeline:
 * - How many records in Convex vs Supabase
 * - Status breakdown
 * - Source breakdown
 * - Pipeline health
 * 
 * Usage:
 *   node scripts/convex-status.js
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const https = require("https");

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const CONVEX_DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY;

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

async function main() {
  console.log("=".repeat(60));
  console.log("Convex Pipeline Status");
  console.log("=".repeat(60));

  // Supabase stats
  const { count: supabaseTotal } = await sp.from("investors").select("*", { count: "exact", head: true });
  const { count: supabaseWithEmail } = await sp.from("investors").select("*", { count: "exact", head: true }).not("email", "is", null);
  const { count: supabaseVerified } = await sp.from("investors").select("*", { count: "exact", head: true }).eq("email_verification_status", "verified");

  console.log("\n📊 SUPABASE (Hot Data)");
  console.log(`  Total investors: ${supabaseTotal}`);
  console.log(`  With email: ${supabaseWithEmail}`);
  console.log(`  Verified emails: ${supabaseVerified}`);

  // Convex stats
  if (!CONVEX_URL || !CONVEX_DEPLOY_KEY) {
    console.log("\n⚠️  CONVEX not configured (missing NEXT_PUBLIC_CONVEX_URL or CONVEX_DEPLOY_KEY)");
    console.log("  Set these in .env.local to enable Convex staging.");
    return;
  }

  try {
    const stats = await convexQuery("rawInvestorsOps:stats");

    console.log("\n📦 CONVEX (Raw Staging)");
    console.log(`  Total raw records: ${stats.total}`);
    console.log(`  Synced to Supabase: ${stats.synced}`);
    console.log(`  Not yet synced: ${stats.unsynced}`);

    console.log("\n  By Status:");
    for (const [status, count] of Object.entries(stats.byStatus)) {
      if (count > 0) console.log(`    ${status}: ${count}`);
    }

    console.log("\n  By Source:");
    for (const [source, count] of Object.entries(stats.bySource)) {
      if (count > 0) console.log(`    ${source}: ${count}`);
    }

    // Pipeline health
    const totalRaw = stats.total;
    const qualified = (stats.byStatus.qualified || 0) + (stats.byStatus.promoted || 0);
    const promoted = stats.byStatus.promoted || 0;
    const rejected = stats.byStatus.rejected || 0;
    const errors = stats.byStatus.error || 0;
    const pending = stats.byStatus.scraped || 0;

    console.log("\n🏥 PIPELINE HEALTH");
    console.log(`  Pending processing: ${pending}`);
    console.log(`  Qualified: ${qualified}`);
    console.log(`  Promoted: ${promoted}`);
    console.log(`  Rejected: ${rejected}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Qualification rate: ${totalRaw > 0 ? ((qualified / totalRaw) * 100).toFixed(1) : 0}%`);
    console.log(`  Promotion rate: ${totalRaw > 0 ? ((promoted / totalRaw) * 100).toFixed(1) : 0}%`);

    // Capacity check
    console.log("\n💾 CAPACITY");
    const freeTierLimit = 500000; // Supabase free tier ~500K rows
    const usedPercent = ((supabaseTotal / freeTierLimit) * 100).toFixed(1);
    console.log(`  Supabase: ${supabaseTotal} / ${freeTierLimit} (${usedPercent}%)`);
    console.log(`  Convex: ${totalRaw} records (unlimited on free tier)`);
    console.log(`  Remaining Supabase capacity: ${freeTierLimit - supabaseTotal} records`);

  } catch (e) {
    console.log(`\n⚠️  Could not reach Convex: ${e.message}`);
    console.log("  Make sure Convex dev server is running: npx convex dev");
  }

  console.log("\n" + "=".repeat(60));
}

main().catch(console.error);
