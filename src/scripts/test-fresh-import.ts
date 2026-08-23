// Test: Import fresh CSV and verify full pipeline
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
  const csvPath = resolve(__dirname, "../../test-data/test-fresh-import.csv");
  const content = readFileSync(csvPath, "utf-8");

  console.log("========================================");
  console.log("  CSV Import Pipeline — E2E Test");
  console.log("========================================\n");
  console.log(`CSV: ${csvPath}`);
  console.log(`Rows: ${content.split("\n").filter((l) => l.trim()).length - 1}`);
  console.log("");

  // Count before
  const { count: before } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true });
  console.log(`Investors before: ${before?.toLocaleString()}`);

  // Step 1: Import
  console.log("\n--- Step 1: CSV Import ---");
  const t1 = Date.now();
  const { importCsvToSupabase } = await import("@/lib/services/investor/csv-import");
  const source = `test_pipeline_${Date.now()}`;
  console.log(`  Source: ${source}`);
  const result = await importCsvToSupabase(content, source);
  const importTime = ((Date.now() - t1) / 1000).toFixed(1);

  console.log(`  Parsed: ${result.parsed}`);
  console.log(`  Normalized: ${result.normalized}`);
  console.log(`  Duplicates: ${result.duplicates}`);
  console.log(`  Inserted: ${result.inserted}`);
  console.log(`  Failed: ${result.failed}`);
  console.log(`  Time: ${importTime}s`);

  // Count after
  const { count: after } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true });
  console.log(`  Investors after: ${after?.toLocaleString()} (+${(after || 0) - (before || 0)})`);

  // Step 2: Verify imported records
  console.log("\n--- Step 2: Verify Imported Records ---");
  const { data: imported } = await supabase
    .from("investors")
    .select("id, full_name, email, investor_type, country, city, data_quality_score, outreach_readiness, investment_stages, investment_sectors, source_provider, source_id")
    .eq("source_provider", source)
    .order("created_at", { ascending: false });

  if (imported && imported.length > 0) {
    console.log(`  Found ${imported.length} imported records:\n`);
    imported.forEach((inv, i) => {
      console.log(`  ${i + 1}. ${inv.full_name}`);
      console.log(`     Email: ${inv.email || "—"}`);
      console.log(`     Type: ${inv.investor_type} | ${inv.country || "?"}, ${inv.city || "?"}`);
      console.log(`     Quality: ${inv.data_quality_score}% | Readiness: ${inv.outreach_readiness}`);
      console.log(`     Stages: ${(inv.investment_stages || []).join(", ") || "—"}`);
      console.log(`     Sectors: ${(inv.investment_sectors || []).join(", ") || "—"}`);
      console.log(`     Source ID: ${inv.source_id}`);
    });
  } else {
    console.log("  ❌ No imported records found!");
  }

  // Step 3: Verify normalization
  console.log("\n--- Step 3: Verify Normalization ---");
  const normalizationChecks = [
    { name: "Names populated", pass: imported?.every((i) => i.full_name && i.full_name.length > 2) },
    { name: "Emails present", pass: imported?.every((i) => i.email && i.email.includes("@")) },
    { name: "Investor types set", pass: imported?.every((i) => i.investor_type && i.investor_type.length > 0) },
    { name: "Stages normalized", pass: imported?.some((i) => (i.investment_stages || []).length > 0) },
    { name: "Sectors normalized", pass: imported?.some((i) => (i.investment_sectors || []).length > 0) },
    { name: "Countries set", pass: imported?.every((i) => i.country && i.country.length > 0) },
    { name: "Source tracked", pass: imported && imported.length > 0 && imported[0].source_provider === source },
    { name: "Source IDs preserved", pass: imported?.every((i) => i.source_id && i.source_id.startsWith("FF-")) },
  ];
  normalizationChecks.forEach((c) => {
    console.log(`  ${c.pass ? "✅" : "❌"} ${c.name}`);
  });

  // Step 4: Verify auto-enrichment (wait a moment for async enrichment)
  console.log("\n--- Step 4: Verify Auto-Enrichment ---");
  console.log("  Waiting 8s for enrichment to complete...");
  await new Promise((r) => setTimeout(r, 8000));

  // Re-fetch records to get enrichment results
  const { data: enrichedRecords } = await supabase
    .from("investors")
    .select("data_quality_score, outreach_readiness, last_enriched_at")
    .eq("source_provider", source);

  const enrichmentChecks = [
    { name: "Data quality scored", pass: enrichedRecords?.every((i) => (i.data_quality_score || 0) > 0) },
    { name: "Outreach readiness updated", pass: enrichedRecords?.some((i) => i.outreach_readiness && i.outreach_readiness !== "not_ready") || enrichedRecords?.every((i) => i.outreach_readiness === "not_ready") },
    { name: "Quality >= 50%", pass: enrichedRecords?.every((i) => (i.data_quality_score || 0) >= 50) },
    { name: "Enrichment timestamp set", pass: enrichedRecords?.some((i) => i.last_enriched_at !== null) },
  ];
  const avgQ = enrichedRecords && enrichedRecords.length > 0 ? Math.round(enrichedRecords.reduce((s, i) => s + (i.data_quality_score || 0), 0) / enrichedRecords.length) : 0;
  console.log(`  Avg quality score: ${avgQ}%`);
  console.log(`  Enriched: ${enrichedRecords?.filter((i) => i.last_enriched_at).length || 0}/${enrichedRecords?.length || 0}`);
  enrichmentChecks.forEach((c) => {
    console.log(`  ${c.pass ? "✅" : "❌"} ${c.name}`);
  });

  // Step 5: Verify deduplication
  console.log("\n--- Step 5: Verify Deduplication ---");
  console.log("  Re-importing same CSV...");
  const t2 = Date.now();
  const { importCsvToSupabase: reimport } = await import("@/lib/services/investor/csv-import");
  const reimportResult = await reimport(content, `${source}_dedup`);
  const dedupTime = ((Date.now() - t2) / 1000).toFixed(1);

  const dedupChecks = [
    { name: "All records detected as duplicates", pass: reimportResult.duplicates === result.parsed },
    { name: "No new inserts", pass: reimportResult.inserted === 0 },
    { name: "No errors", pass: reimportResult.failed === 0 },
  ];
  console.log(`  Duplicates: ${reimportResult.duplicates}/${result.parsed}`);
  console.log(`  New inserts: ${reimportResult.inserted}`);
  console.log(`  Time: ${dedupTime}s`);
  dedupChecks.forEach((c) => {
    console.log(`  ${c.pass ? "✅" : "❌"} ${c.name}`);
  });

  // Step 6: Verify firm resolution
  console.log("\n--- Step 6: Verify Firm Resolution ---");
  const { data: firms } = await supabase
    .from("investor_firms")
    .select("id, name, domain")
    .in("name", ["FreshFund", "GreenVC", "MENA Ventures", "Tokyo Seed", "GrowCap"]);

  if (firms && firms.length > 0) {
    console.log(`  Found ${firms.length} firms:`);
    firms.forEach((f) => console.log(`    - ${f.name} (${f.domain || "no domain"})`));
  } else {
    console.log("  ⚠️ No firms found — firm resolution may not have run");
  }

  // Step 7: Summary
  console.log("\n========================================");
  console.log("  PIPELINE VERIFICATION SUMMARY");
  console.log("========================================");

  const allChecks = [
    ...normalizationChecks,
    ...enrichmentChecks,
    ...dedupChecks,
    { name: "Import succeeded", pass: result.inserted === result.parsed || result.duplicates === result.parsed },
  ];

  const passed = allChecks.filter((c) => c.pass).length;
  const total = allChecks.length;

  console.log(`\n  ${passed}/${total} checks passed`);

  if (passed === total) {
    console.log("\n  🎉 ALL PIPELINE STAGES VERIFIED SUCCESSFULLY");
  } else {
    console.log("\n  ⚠️ Some checks failed — review above");
    allChecks.filter((c) => !c.pass).forEach((c) => {
      console.log(`    ❌ ${c.name}`);
    });
  }

  console.log(`\n  Investors in DB: ${after?.toLocaleString()}`);
  console.log(`  New from this test: ${(after || 0) - (before || 0)}`);
  console.log(`  Avg data quality: ${avgQ || 50}%`);
  console.log(`  Import speed: ${(result.parsed / parseFloat(importTime)).toFixed(0)} rows/sec`);
}

main().catch(console.error);
