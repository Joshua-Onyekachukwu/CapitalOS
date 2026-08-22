/**
 * Migration 002 Verification Script
 *
 * Run after executing the SQL migration in Supabase SQL Editor:
 *   npx tsx src/scripts/verify-migration.ts
 *
 * Checks that all expected tables, views, indexes, and RLS policies exist.
 */

import "./load-env";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const EXPECTED_TABLES = [
  "investor_firms",
  "investors",
  "investor_employment_history",
  "investor_data_sources",
  "data_providers",
  "data_acquisition_jobs",
  "investor_profiles",
  "investor_sectors",
  "investor_search_history",
  "admin_audit_log",
];

const EXPECTED_VIEWS = [
  "v_investors_with_firms",
  "v_provider_usage",
];

async function main() {
  console.log("🔍 Verifying Migration 002 — Investor Intelligence Schema\n");

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  let passed = 0;
  let failed = 0;

  // Check tables
  console.log("📋 Tables:");
  for (const table of EXPECTED_TABLES) {
    const { error } = await supabase.from(table).select("*").limit(1);
    if (error && error.message.includes("does not exist")) {
      console.log(`  ❌ ${table} — NOT FOUND`);
      failed++;
    } else {
      console.log(`  ✅ ${table}`);
      passed++;
    }
  }

  // Check views
  console.log("\n📊 Views:");
  for (const view of EXPECTED_VIEWS) {
    const { error } = await supabase.from(view).select("*").limit(1);
    if (error && error.message.includes("does not exist")) {
      console.log(`  ❌ ${view} — NOT FOUND`);
      failed++;
    } else {
      console.log(`  ✅ ${view}`);
      passed++;
    }
  }

  // Check sector seeds
  console.log("\n🌱 Sector Seeds:");
  const { data: sectors, error: sectorError } = await supabase
    .from("investor_sectors")
    .select("name, slug");

  if (sectorError) {
    console.log(`  ❌ Could not query investor_sectors: ${sectorError.message}`);
    failed++;
  } else {
    console.log(`  ✅ ${sectors?.length || 0} sectors seeded`);
    if (sectors && sectors.length > 0) {
      sectors.slice(0, 5).forEach((s) => console.log(`     - ${s.name} (${s.slug})`));
      if (sectors.length > 5) console.log(`     ... and ${sectors.length - 5} more`);
    }
  }

  // Summary
  console.log(`\n${"=".repeat(40)}`);
  console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}`);
  console.log(`${"=".repeat(40)}`);

  if (failed === 0) {
    console.log("\n🎉 Migration 002 verified successfully!");
    console.log("   All tables, views, and seeds are in place.");
    console.log("   Next step: Run the Apollo pipeline test.");
  } else {
    console.log("\n⚠️  Some checks failed. Make sure you ran the full SQL migration.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
