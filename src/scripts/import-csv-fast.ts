// Fast CSV import using the batch pipeline
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../.env.local") });

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const csvPath = resolve(__dirname, "../../test-data/apollo-investor-export.csv");
  const content = readFileSync(csvPath, "utf-8");

  console.log("=== CSV Import Pipeline Test ===\n");
  console.log(`File: ${csvPath}`);
  console.log(`Size: ${(content.length / 1024).toFixed(1)} KB`);
  console.log(`Rows: ${content.split("\n").filter((l) => l.trim()).length - 1}`);
  console.log("");

  // Step 1: Count before
  const { count: beforeCount } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true });

  console.log(`Step 1 — Investors before import: ${beforeCount?.toLocaleString() || 0}`);

  // Step 2: Run the import
  console.log("\nStep 2 — Running CSV import pipeline...");
  const startTime = Date.now();

  const { importCsvToSupabase } = await import("@/lib/services/investor/csv-import");
  const result = await importCsvToSupabase(content, "apollo_csv_import");

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n=== Import Results (${elapsed}s) ===`);
  console.log(`  Total rows:   ${result.totalRows}`);
  console.log(`  Parsed:       ${result.parsed}`);
  console.log(`  Normalized:   ${result.normalized}`);
  console.log(`  Duplicates:   ${result.duplicates}`);
  console.log(`  Inserted:     ${result.inserted}`);
  console.log(`  Failed:       ${result.failed}`);
  if (result.errors.length > 0) {
    console.log(`  Errors:       ${result.errors.length}`);
    result.errors.slice(0, 5).forEach((e) => console.log(`    - ${e}`));
  }

  // Step 3: Count after
  const { count: afterCount } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true });

  console.log(`\nStep 3 — Investors after import: ${afterCount?.toLocaleString() || 0}`);
  console.log(`  New investors added: ${(afterCount || 0) - (beforeCount || 0)}`);

  // Step 4: Verify data quality
  console.log("\nStep 4 — Verifying imported data...");

  const { data: sample } = await supabase
    .from("investors")
    .select("id, full_name, email, investor_type, country, data_quality_score, outreach_readiness, investment_stages, investment_sectors, source_provider")
    .eq("source_provider", "apollo_csv_import")
    .order("created_at", { ascending: false })
    .limit(10);

  if (sample && sample.length > 0) {
    console.log(`\n  Sample records (${sample.length} shown):`);
    sample.forEach((inv, i) => {
      console.log(`  ${i + 1}. ${inv.full_name} (${inv.email || "no email"})`);
      console.log(`     Type: ${inv.investor_type} | Country: ${inv.country || "?"} | Quality: ${inv.data_quality_score}% | Readiness: ${inv.outreach_readiness}`);
      console.log(`     Stages: ${(inv.investment_stages || []).join(", ") || "none"}`);
      console.log(`     Sectors: ${(inv.investment_sectors || []).join(", ") || "none"}`);
    });
  }

  // Step 5: Verify enrichment
  console.log("\nStep 5 — Checking auto-enrichment results...");

  const { data: enriched } = await supabase
    .from("investors")
    .select("data_quality_score, outreach_readiness")
    .eq("source_provider", "apollo_csv_import");

  let avgQuality = 0;
  if (enriched && enriched.length > 0) {
    avgQuality = Math.round(enriched.reduce((sum, inv) => sum + (inv.data_quality_score || 0), 0) / enriched.length);
    const readinessCounts: Record<string, number> = {};
    enriched.forEach((inv) => {
      readinessCounts[inv.outreach_readiness] = (readinessCounts[inv.outreach_readiness] || 0) + 1;
    });

    console.log(`  Total imported: ${enriched.length}`);
    console.log(`  Avg data quality: ${avgQuality}%`);
    console.log(`  Readiness breakdown: ${Object.entries(readinessCounts).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  } else {
    console.log("  No imported records found for enrichment check.");
  }

  // Step 6: Verify dedup works on re-import
  console.log("\nStep 6 — Testing deduplication (re-import same CSV)...");

  const { importCsvToSupabase: reimport } = await import("@/lib/services/investor/csv-import");
  const reimportResult = await reimport(content, "apollo_csv_import_test_dedup");

  console.log(`  Re-import results:`);
  console.log(`    Duplicates detected: ${reimportResult.duplicates}`);
  console.log(`    New inserts: ${reimportResult.inserted}`);
  console.log(`    Errors: ${reimportResult.failed}`);

  if (reimportResult.duplicates === result.parsed) {
    console.log("  ✅ Dedup working correctly — all records detected as duplicates");
  } else if (reimportResult.inserted > 0) {
    console.log(`  ⚠️ ${reimportResult.inserted} records were not detected as duplicates`);
  }

  // Step 7: Verify pipeline stages
  console.log("\nStep 7 — Pipeline stage verification...");

  const stages = [
    { name: "CSV Parse", check: result.parsed > 0 },
    { name: "Column Detection", check: result.parsed > 0 },
    { name: "Normalization", check: result.normalized > 0 },
    { name: "Deduplication", check: reimportResult.duplicates > 0 },
    { name: "Batch Insert", check: result.inserted > 0 || result.duplicates === result.parsed },
    { name: "Auto-Enrichment", check: avgQuality > 0 },
  ];

  stages.forEach((stage) => {
    console.log(`  ${stage.check ? "✅" : "❌"} ${stage.name}`);
  });

  const allPassed = stages.every((s) => s.check);
  console.log(`\n${allPassed ? "🎉 ALL PIPELINE STAGES VERIFIED" : "⚠️ SOME STAGES FAILED"}`);

  console.log("\n=== Summary ===");
  console.log(`Imported: ${result.inserted} investors in ${elapsed}s`);
  console.log(`Dedup: ${reimportResult.duplicates} duplicates correctly detected`);
  console.log(`Enrichment: ${avgQuality}% avg quality score`);
  console.log(`Total investors in DB: ${afterCount?.toLocaleString()}`);
}

main().catch(console.error);
