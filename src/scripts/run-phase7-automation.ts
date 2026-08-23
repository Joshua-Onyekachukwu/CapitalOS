// =============================================
// Phase 7 Automation Runner
// =============================================
// Runs all three automation services:
// 1. Auto-enrich investors (data quality, outreach readiness)
// 2. Scheduled deduplication (multi-signal matching)
// 3. Email reply polling (connected accounts)
//
// Usage:
//   npx tsx src/scripts/run-phase7-automation.ts          # Run all
//   npx tsx src/scripts/run-phase7-automation.ts enrich   # Enrich only
//   npx tsx src/scripts/run-phase7-automation.ts dedup    # Dedup only
//   npx tsx src/scripts/run-phase7-automation.ts poll     # Email poll only

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../.env.local") });

async function runEnrichment() {
  console.log("=== Auto-Enrichment ===");
  const { enrichBatch } = await import("../lib/services/investor/enrichment");
  const result = await enrichBatch(500);
  console.log(`  Enriched: ${result.enriched}`);
  console.log(`  Skipped: ${result.skipped}`);
  console.log(`  Errors: ${result.errors}`);
  return result;
}

async function runDeduplication() {
  console.log("=== Scheduled Deduplication ===");
  const { runScheduledDedup } = await import("../lib/services/investor/scheduled-dedup");
  const result = await runScheduledDedup(500, 50);
  console.log(`  Scanned: ${result.scanned}`);
  console.log(`  Candidates found: ${result.candidatesFound}`);
  console.log(`  Auto-merged: ${result.autoMerged}`);
  console.log(`  Queued for review: ${result.queuedForReview}`);
  console.log(`  Errors: ${result.errors}`);
  return result;
}

async function runEmailPolling() {
  console.log("=== Email Reply Polling ===");
  const { pollEmailAccounts } = await import("../lib/services/email/reply-poller");
  const results = await pollEmailAccounts();
  console.log(`  Accounts polled: ${results.length}`);
  for (const r of results) {
    console.log(`    ${r.provider}: ${r.emailsChecked} checked, ${r.repliesDetected} replies`);
    if (r.errors.length > 0) {
      r.errors.forEach((e) => console.log(`      Error: ${e}`));
    }
  }
  return results;
}

async function main() {
  const task = process.argv[2] || "all";

  console.log(`=== Phase 7 Automation — ${task} ===`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("");

  const startTime = Date.now();

  try {
    if (task === "all" || task === "enrich") {
      await runEnrichment();
      console.log("");
    }

    if (task === "all" || task === "dedup") {
      await runDeduplication();
      console.log("");
    }

    if (task === "all" || task === "poll") {
      await runEmailPolling();
      console.log("");
    }
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`=== Done in ${elapsed}s ===`);
}

main().catch(console.error);
