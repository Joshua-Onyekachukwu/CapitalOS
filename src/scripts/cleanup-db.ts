// =============================================
// Capital OS — Database Cleanup Script
// =============================================
// Run: npx tsx src/scripts/cleanup-db.ts [action]
// Actions: audit, clean, compact

import { query, closePool } from "./db";

const action = process.argv[2] || "audit";

async function audit() {
  console.log("\n📊 Database Audit\n");
  console.log("=".repeat(50));

  const tables = [
    "investors", "investor_firms", "investor_employment_history",
    "investor_profiles", "investor_data_sources", "data_change_log",
    "email_messages", "email_accounts", "email_tracking_events",
    "campaign_sequence_emails", "campaign_sequence_enrollments",
    "company_profiles", "company_documents", "company_team_members",
  ];

  console.log("\n📋 Record Counts:");
  for (const table of tables) {
    try {
      const rows = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table}`);
      console.log(`   ${table.padEnd(35)} ${parseInt(rows[0]?.count || "0").toLocaleString()}`);
    } catch {
      console.log(`   ${table.padEnd(35)} (table not found)`);
    }
  }

  console.log("\n🔍 Investors Breakdown:");

  const sources = await query<{ source: string }>(
    `SELECT source FROM investors LIMIT 10000`
  );
  const sourceCounts: Record<string, number> = {};
  for (const s of sources) {
    sourceCounts[s.source || "unknown"] = (sourceCounts[s.source || "unknown"] || 0) + 1;
  }
  console.log("   By source (sampled 10K):");
  for (const [source, count] of Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${source.padEnd(20)} ${count}`);
  }

  const withEmail = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM investors WHERE email IS NOT NULL AND email != ''`
  );
  const total = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM investors`
  );

  console.log(`\n   Total investors:    ${parseInt(total[0]?.count || "0").toLocaleString()}`);
  console.log(`   With email:         ${parseInt(withEmail[0]?.count || "0").toLocaleString()}`);

  console.log("\n" + "=".repeat(50));
  console.log("\n💡 To reduce size, run: npx tsx src/scripts/cleanup-db.ts clean");
}

async function clean() {
  console.log("\n🧹 Database Cleanup\n");
  console.log("=".repeat(50));

  let totalDeleted = 0;

  // 1. Delete investors with no email AND no LinkedIn
  console.log("\n1️⃣  Removing investors with no email AND no LinkedIn...");
  const noContact = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM investors WHERE email IS NULL AND linkedin_url IS NULL`
  );
  const noContactCount = parseInt(noContact[0]?.count || "0");

  if (noContactCount > 0) {
    const BATCH = 5000;
    let deleted = 0;
    while (deleted < noContactCount) {
      const batch = await query<{ id: string }>(
        `SELECT id FROM investors WHERE email IS NULL AND linkedin_url IS NULL LIMIT $1`,
        [BATCH]
      );
      if (!batch.length) break;

      const ids = batch.map((r) => r.id);
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
      await query(`DELETE FROM investors WHERE id IN (${placeholders})`, ids);
      deleted += ids.length;
      console.log(`   📥 Deleted ${deleted} / ${noContactCount}`);
    }
    totalDeleted += deleted;
    console.log(`   ✅ Removed ${deleted} investors with no contact info`);
  } else {
    console.log("   ✅ No records to remove");
  }

  // 2. Remove duplicate emails
  console.log("\n2️⃣  Removing duplicate emails...");
  const dupes = await query<{ id: string }>(
    `SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
      FROM investors WHERE email IS NOT NULL AND email != ''
    ) t WHERE rn > 1`
  );

  if (dupes.length > 0) {
    const BATCH = 5000;
    for (let i = 0; i < dupes.length; i += BATCH) {
      const batch = dupes.slice(i, i + BATCH).map((r) => r.id);
      const placeholders = batch.map((_, j) => `$${j + 1}`).join(", ");
      await query(`DELETE FROM investors WHERE id IN (${placeholders})`, batch);
    }
    totalDeleted += dupes.length;
    console.log(`   ✅ Removed ${dupes.length} duplicate email records`);
  } else {
    console.log("   ✅ No duplicates found");
  }

  // 3. Remove unscored investors with no email
  console.log("\n3️⃣  Removing unscored investors with no email...");
  const unscored = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM investors WHERE fit_score = 0 AND email IS NULL`
  );
  const unscoredCount = parseInt(unscored[0]?.count || "0");

  if (unscoredCount > 0) {
    const BATCH = 5000;
    let deleted = 0;
    while (deleted < unscoredCount) {
      const batch = await query<{ id: string }>(
        `SELECT id FROM investors WHERE fit_score = 0 AND email IS NULL LIMIT $1`,
        [BATCH]
      );
      if (!batch.length) break;

      const ids = batch.map((r) => r.id);
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
      await query(`DELETE FROM investors WHERE id IN (${placeholders})`, ids);
      deleted += ids.length;
    }
    totalDeleted += deleted;
    console.log(`   ✅ Removed ${deleted} unscored investors with no email`);
  } else {
    console.log("   ✅ No records to remove");
  }

  // 4. Clean old change logs (30 days)
  console.log("\n4️⃣  Cleaning old change logs...");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const oldLogs = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM data_change_log WHERE created_at < $1`,
    [thirtyDaysAgo]
  );
  const oldLogsCount = parseInt(oldLogs[0]?.count || "0");

  if (oldLogsCount > 0) {
    await query(`DELETE FROM data_change_log WHERE created_at < $1`, [thirtyDaysAgo]);
    totalDeleted += oldLogsCount;
    console.log(`   ✅ Removed ${oldLogsCount} old change log entries`);
  } else {
    console.log("   ✅ No old logs to remove");
  }

  console.log("\n" + "=".repeat(50));
  console.log(`\n🎉 Cleanup complete! Total records removed: ${totalDeleted.toLocaleString()}`);
}

async function compact() {
  console.log("\n🔧 Compacting Tables\n");
  console.log("=".repeat(50));
  console.log("\nRun these in CockroachDB SQL to reclaim space:\n");
  console.log("VACUUM (VERBOSE, ANALYZE) public.investors;");
  console.log("VACUUM (VERBOSE, ANALYZE) public.investor_firms;");
  console.log("\nNote: CockroachDB handles storage reclamation automatically.");
}

async function main() {
  if (action === "audit") await audit();
  else if (action === "clean") await clean();
  else if (action === "compact") await compact();
  else {
    console.log("Usage: npx tsx src/scripts/cleanup-db.ts [audit|clean|compact]");
  }
  await closePool();
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
