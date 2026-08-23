import { query, closePool } from "./db";

const EXPECTED_TABLES = [
  "investor_firms", "investors", "investor_employment_history",
  "investor_data_sources", "data_providers", "data_acquisition_jobs",
  "investor_profiles", "investor_sectors", "investor_search_history", "admin_audit_log",
];

async function main() {
  console.log("🔍 Verifying Migration — Investor Intelligence Schema\n");

  let passed = 0;
  let failed = 0;

  console.log("📋 Tables:");
  for (const table of EXPECTED_TABLES) {
    try {
      await query(`SELECT 1 FROM ${table} LIMIT 1`);
      console.log(`  ✅ ${table}`);
      passed++;
    } catch {
      console.log(`  ❌ ${table} — NOT FOUND`);
      failed++;
    }
  }

  console.log("\n🌱 Sector Seeds:");
  try {
    const sectors = await query<{ name: string; slug: string }>(
      `SELECT name, slug FROM investor_sectors`
    );
    console.log(`  ✅ ${sectors.length} sectors seeded`);
    sectors.slice(0, 5).forEach((s) => console.log(`     - ${s.name} (${s.slug})`));
    if (sectors.length > 5) console.log(`     ... and ${sectors.length - 5} more`);
  } catch (err: any) {
    console.log(`  ❌ Could not query investor_sectors: ${err.message}`);
    failed++;
  }

  console.log(`\n${"=".repeat(40)}`);
  console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}`);
  console.log(`${"=".repeat(40)}`);

  if (failed === 0) {
    console.log("\n🎉 Migration verified successfully!");
  } else {
    console.log("\n⚠️  Some checks failed.");
    process.exit(1);
  }

  await closePool();
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
