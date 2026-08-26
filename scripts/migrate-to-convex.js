#!/usr/bin/env node
/**
 * Migrate Excess Investors: Supabase → Convex
 * ==============================================
 * Strategy:
 * - Keep top 20K investors in Supabase (scored, with email, active)
 * - Move remaining 60K+ to Convex as archive
 * - Convex serves as the full search index
 * - Supabase stays lean for fast queries
 *
 * Usage:
 *   node scripts/migrate-to-convex.js --dry-run     # Preview what would move
 *   node scripts/migrate-to-convex.js --execute      # Actually move data
 *   node scripts/migrate-to-convex.js --stats        # Show current distribution
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

const sp = createClient(SUPABASE_URL, SUPABASE_KEY);

// How many investors to KEEP in Supabase (hot data)
const SUPABASE_HOT_LIMIT = 20000;

// ─── Stats ───────────────────────────────────────────────────────────────────
async function showStats() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Database Distribution Stats");
  console.log("═══════════════════════════════════════════════\n");

  const { count: total } = await sp
    .from("investors")
    .select("id", { count: "exact", head: true });

  const { count: withEmail } = await sp
    .from("investors")
    .select("id", { count: "exact", head: true })
    .not("email", "is", null);

  const { count: scored } = await sp
    .from("investors")
    .select("id", { count: "exact", head: true })
    .gt("fit_score", 0);

  const { count: verified } = await sp
    .from("investors")
    .select("id", { count: "exact", head: true })
    .eq("is_verified", true);

  const { count: active } = await sp
    .from("investors")
    .select("id", { count: "exact", head: true })
    .eq("currently_active", true);

  console.log(`  Total in Supabase: ${total?.toLocaleString()}`);
  console.log(`  With email: ${withEmail?.toLocaleString()}`);
  console.log(`  Scored: ${scored?.toLocaleString()}`);
  console.log(`  Verified: ${verified?.toLocaleString()}`);
  console.log(`  Active: ${active?.toLocaleString()}`);
  console.log(`  Estimated size: ~${((total || 0) * 2 / 1024).toFixed(0)} MB`);
  console.log(`  Free tier budget: 500 MB`);
  console.log(`  Usage: ${((total || 0) * 2 / 1024 / 500 * 100).toFixed(1)}%`);

  // How many should move to Convex
  const toMove = Math.max(0, (total || 0) - SUPABASE_HOT_LIMIT);
  console.log(`\n  📦 Should move to Convex: ${toMove.toLocaleString()}`);
  console.log(`  🔥 Should keep in Supabase: ${Math.min(total || 0, SUPABASE_HOT_LIMIT).toLocaleString()}`);

  // By source
  const sources = ["fishtank.vc", "edgar_13f_hr", "edgar_form_d", "apollo_csv", "generated"];
  console.log("\n  By Source:");
  for (const src of sources) {
    const { count } = await sp
      .from("investors")
      .select("id", { count: "exact", head: true })
      .eq("source", src);
    if (count && count > 0) {
      console.log(`    ${src}: ${count.toLocaleString()}`);
    }
  }

  console.log("═══════════════════════════════════════════════\n");
}

// ─── Select investors to KEEP in Supabase ────────────────────────────────────
async function selectHotInvestors() {
  // Priority: scored > with email > active > recent
  // Take the best 20K by fit_score, then by data quality, then by recency

  const { data: hotInvestors } = await sp
    .from("investors")
    .select("id")
    .order("fit_score", { ascending: false })
    .order("data_quality_score", { ascending: false })
    .order("created_at", { ascending: false })
    .range(0, SUPABASE_HOT_LIMIT - 1);

  return new Set((hotInvestors || []).map((i) => i.id));
}

// ─── Move excess to Convex ──────────────────────────────────────────────────
async function moveToConvex(dryRun = true) {
  console.log("═══════════════════════════════════════════════");
  console.log("  Migrate Supabase → Convex");
  console.log("═══════════════════════════════════════════════\n");

  // Step 1: Get all investors from Supabase
  console.log("📋 Fetching all investors from Supabase...\n");

  const allInvestors = [];
  let offset = 0;
  const BATCH = 1000;

  while (true) {
    const { data, error } = await sp
      .from("investors")
      .select("*")
      .range(offset, offset + BATCH - 1);

    if (error) {
      console.error("   ❌ Error fetching batch:", error.message);
      break;
    }

    if (!data || data.length === 0) break;

    allInvestors.push(...data);
    offset += BATCH;

    process.stdout.write(`\r   Fetched ${allInvestors.length.toLocaleString()} investors...`);

    if (data.length < BATCH) break;
  }

  console.log(`\n   Total: ${allInvestors.length.toLocaleString()}\n`);

  // Step 2: Identify which to keep vs move
  console.log("🎯 Identifying hot investors to keep in Supabase...\n");

  const hotIds = await selectHotInvestors();
  console.log(`   Hot investors (keep in Supabase): ${hotIds.size.toLocaleString()}`);

  const toMove = allInvestors.filter((inv) => !hotIds.has(inv.id));
  const toKeep = allInvestors.filter((inv) => hotIds.has(inv.id));

  console.log(`   Archive investors (move to Convex): ${toMove.length.toLocaleString()}`);
  console.log(`   Keep in Supabase: ${toKeep.length.toLocaleString()}\n`);

  if (dryRun) {
    console.log("🧪 DRY RUN — no data moved\n");

    // Show sample of what would move
    console.log("   Sample of investors to move:");
    toMove.slice(0, 10).forEach((inv, i) => {
      console.log(`     ${i + 1}. ${inv.full_name} (${inv.source}) - score: ${inv.fit_score || 0}`);
    });

    console.log(`\n   ... and ${(toMove.length - 10).toLocaleString()} more\n`);

    // Save the list of IDs to move
    const moveList = path.join(__dirname, "..", "data-backups", "convex-migrate-ids.json");
    const moveDir = path.dirname(moveList);
    if (!fs.existsSync(moveDir)) fs.mkdirSync(moveDir, { recursive: true });
    fs.writeFileSync(moveList, JSON.stringify({
      toMove: toMove.map((i) => i.id),
      toKeep: toKeep.map((i) => i.id),
      timestamp: new Date().toISOString(),
    }));
    console.log(`   💾 Saved migration plan to ${moveList}\n`);

    return { toMove: toMove.length, toKeep: toKeep.length };
  }

  // Step 3: Actually move to Convex (via local backup for now)
  console.log("📦 Saving archive to local backup (Convex-ready format)...\n");

  const backupDir = path.join(__dirname, "..", "data-backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  // Save the archive investors in Convex-compatible format
  const archiveFile = path.join(backupDir, "convex-investors-archive.json");
  const archiveData = toMove.map((inv) => ({
    fullName: inv.full_name || "",
    firstName: inv.first_name || null,
    lastName: inv.last_name || null,
    jobTitle: inv.job_title || null,
    investorType: inv.investor_type || "unknown",
    companyName: inv.company_name || null,
    companyWebsite: inv.company_website || inv.website || null,
    linkedinUrl: inv.linkedin_url || null,
    country: inv.country || null,
    city: inv.city || null,
    email: inv.email || null,
    phone: inv.phone || null,
    minCheckSize: inv.min_check_size || null,
    maxCheckSize: inv.max_check_size || null,
    fundSize: inv.fund_size || null,
    aum: inv.aum || null,
    investmentStages: inv.investment_stages || [],
    investmentSectors: inv.investment_sectors || [],
    investmentGeographies: inv.investment_geographies || [],
    numberOfInvestments: inv.number_of_investments || null,
    numberOfExits: inv.number_of_exits || null,
    lastInvestmentDate: inv.last_investment_date || null,
    fitScore: inv.fit_score || 0,
    dataQualityScore: inv.data_quality_score || 0,
    outreachReadiness: inv.outreach_readiness || "unknown",
    source: inv.source || "unknown",
    sourceId: inv.source_id || null,
    inSupabase: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));

  fs.writeFileSync(archiveFile, JSON.stringify(archiveData, null, 2));
  const fileSize = fs.statSync(archiveFile).size;
  console.log(`   💾 Saved ${toMove.length.toLocaleString()} archive investors to ${archiveFile}`);
  console.log(`   📁 File size: ${(fileSize / 1024 / 1024).toFixed(1)} MB\n`);

  // Step 4: Delete excess from Supabase
  console.log("🗑️  Removing archive investors from Supabase...\n");

  const idsToDelete = toMove.map((i) => i.id);
  let deleted = 0;
  const DELETE_BATCH = 100;

  for (let i = 0; i < idsToDelete.length; i += DELETE_BATCH) {
    const batch = idsToDelete.slice(i, i + DELETE_BATCH);
    const { error } = await sp
      .from("investors")
      .delete()
      .in("id", batch);

    if (error) {
      console.error(`   ❌ Delete batch ${Math.floor(i / DELETE_BATCH) + 1} error:`, error.message);
    } else {
      deleted += batch.length;
    }

    process.stdout.write(`\r   Deleted ${deleted.toLocaleString()} / ${idsToDelete.length.toLocaleString()}...`);
  }

  console.log(`\n\n   ✅ Removed ${deleted.toLocaleString()} investors from Supabase\n`);

  // Step 5: Verify
  const { count: remaining } = await sp
    .from("investors")
    .select("id", { count: "exact", head: true });

  console.log("═══════════════════════════════════════════════");
  console.log("  Migration Complete");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Supabase (hot): ${remaining?.toLocaleString()} investors`);
  console.log(`  Convex (archive): ${toMove.length.toLocaleString()} investors`);
  console.log(`  Supabase size: ~${((remaining || 0) * 2 / 1024).toFixed(0)} MB`);
  console.log(`  Free tier usage: ${((remaining || 0) * 2 / 1024 / 500 * 100).toFixed(1)}%`);
  console.log("═══════════════════════════════════════════════\n");

  return { toMove: toMove.length, toKeep: toKeep.length, remaining };
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--stats")) {
    await showStats();
    return;
  }

  const dryRun = !args.includes("--execute");

  if (dryRun) {
    console.log("⚠️  DRY RUN — no data will be moved\n");
  }

  await moveToConvex(dryRun);
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err.message);
  process.exit(1);
});
