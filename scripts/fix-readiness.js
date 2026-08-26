#!/usr/bin/env node
/**
 * Outreach Readiness Recalculation
 * =================================
 * Fixes outreach_readiness based on fit_score and email availability.
 * The old logic required data_quality_score >= 60 which was too restrictive.
 *
 * New rules:
 *   - ready: fit_score >= 50 AND has email
 *   - needs_verification: fit_score >= 30 OR has email (but not ready)
 *   - low_priority: everything else
 *
 * Usage:
 *   node scripts/fix-readiness.js --dry-run
 *   node scripts/fix-readiness.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { createClient } = require("@supabase/supabase-js");

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const sp = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log("═══════════════════════════════════════════════");
  console.log("  Outreach Readiness Recalculation");
  console.log("═══════════════════════════════════════════════\n");

  if (dryRun) console.log("🧪 DRY RUN\n");

  // Count current state
  const { count: total } = await sp.from("investors").select("*", { count: "exact", head: true });
  const { count: currentReady } = await sp.from("investors").select("*", { count: "exact", head: true }).eq("outreach_readiness", "ready");
  const { count: currentLow } = await sp.from("investors").select("*", { count: "exact", head: true }).eq("outreach_readiness", "low_priority");
  const { count: currentNeeds } = await sp.from("investors").select("*", { count: "exact", head: true }).eq("outreach_readiness", "needs_verification");

  console.log(`   Current state: ${total} total`);
  console.log(`   Ready: ${currentReady}`);
  console.log(`   Needs verification: ${currentNeeds}`);
  console.log(`   Low priority: ${currentLow}\n`);

  // Calculate new readiness
  // Batch 1: Ready = fit_score >= 50 AND has email
  const { count: newReady } = await sp.from("investors")
    .select("*", { count: "exact", head: true })
    .gte("fit_score", 50)
    .not("email", "is", null)
    .neq("email", "");

  // Batch 2: Needs verification = (fit_score >= 30 OR has email) AND NOT ready
  const { count: newNeeds } = await sp.from("investors")
    .select("*", { count: "exact", head: true })
    .or("fit_score.gte.30,email.not.is.")
    .neq("email", "")
    .not("fit_score", "gte", 50);

  const newLow = (total || 0) - (newReady || 0) - (newNeeds || 0);

  console.log(`   New distribution:`);
  console.log(`   Ready: ${newReady} (was ${currentReady})`);
  console.log(`   Needs verification: ${newNeeds} (was ${currentNeeds})`);
  console.log(`   Low priority: ${newLow} (was ${currentLow})\n`);

  if (dryRun) {
    console.log("   Run without --dry-run to apply changes.\n");
    return;
  }

  // Apply updates in batches
  let updated = 0;
  const BATCH = 500;

  // Update ready investors
  console.log("   Updating 'ready' investors...");
  const { data: readyInvestors } = await sp.from("investors")
    .select("id")
    .gte("fit_score", 50)
    .not("email", "is", null)
    .neq("email", "")
    .limit(10000);

  if (readyInvestors) {
    for (let i = 0; i < readyInvestors.length; i += BATCH) {
      const batch = readyInvestors.slice(i, i + BATCH);
      const ids = batch.map(r => r.id);
      await sp.from("investors").update({ outreach_readiness: "ready" }).in("id", ids);
      updated += batch.length;
      process.stdout.write(`\r   Updated ready: ${updated}...`);
    }
  }
  console.log(`\n   Ready: ${updated}`);

  // Update needs_verification (fit >= 30 but < 50, has email)
  let needsUpdated = 0;
  console.log("   Updating 'needs_verification' investors...");
  const { data: needsInvestors } = await sp.from("investors")
    .select("id")
    .gte("fit_score", 30)
    .lt("fit_score", 50)
    .not("email", "is", null)
    .neq("email", "")
    .limit(10000);

  if (needsInvestors) {
    for (let i = 0; i < needsInvestors.length; i += BATCH) {
      const batch = needsInvestors.slice(i, i + BATCH);
      const ids = batch.map(r => r.id);
      await sp.from("investors").update({ outreach_readiness: "needs_verification" }).in("id", ids);
      needsUpdated += batch.length;
      process.stdout.write(`\r   Updated needs_verification: ${needsUpdated}...`);
    }
  }
  console.log(`\n   Needs verification: ${needsUpdated}`);

  // Update low priority (everything else)
  let lowUpdated = 0;
  console.log("   Updating 'low_priority' investors...");
  // Get all IDs that are NOT ready or needs_verification
  const { data: lowInvestors } = await sp.from("investors")
    .select("id")
    .or("outreach_readiness.eq.ready,outreach_readiness.eq.needs_verification")
    .limit(1);

  // Instead, update all remaining
  // First mark everything as low_priority, then the above overrides
  const { count: lowCount } = await sp.from("investors")
    .select("*", { count: "exact", head: true })
    .neq("outreach_readiness", "ready")
    .neq("outreach_readiness", "needs_verification");

  if (lowCount && lowCount > 0) {
    // Paginate through all low_priority investors
    let offset = 0;
    while (offset < lowCount) {
      const { data: batch } = await sp.from("investors")
        .select("id")
        .neq("outreach_readiness", "ready")
        .neq("outreach_readiness", "needs_verification")
        .range(offset, offset + BATCH - 1);

      if (!batch || batch.length === 0) break;

      const ids = batch.map(r => r.id);
      await sp.from("investors").update({ outreach_readiness: "low_priority" }).in("id", ids);
      lowUpdated += batch.length;
      offset += batch.length;
      process.stdout.write(`\r   Updated low_priority: ${lowUpdated}...`);
    }
  }
  console.log(`\n   Low priority: ${lowUpdated}`);

  // Verify final state
  const { count: finalReady } = await sp.from("investors").select("*", { count: "exact", head: true }).eq("outreach_readiness", "ready");
  const { count: finalNeeds } = await sp.from("investors").select("*", { count: "exact", head: true }).eq("outreach_readiness", "needs_verification");
  const { count: finalLow } = await sp.from("investors").select("*", { count: "exact", head: true }).eq("outreach_readiness", "low_priority");

  console.log(`\n   ✅ Final state:`);
  console.log(`   Ready: ${finalReady}`);
  console.log(`   Needs verification: ${finalNeeds}`);
  console.log(`   Low priority: ${finalLow}\n`);
}

main().catch(console.error);
