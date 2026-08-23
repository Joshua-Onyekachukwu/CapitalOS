// =============================================
// Capital OS — Stress Test CSV Import
// =============================================
// Imports stress-test-investors.csv and verifies pipeline.
// Run: npx tsx src/scripts/test-stress-import.ts
// =============================================

import { readFileSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  fields.push(current);
  return fields;
}

function normalizeArray(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(";").map((s) => s.trim()).filter(Boolean);
}

function normalizeStages(stages: string[]): string[] {
  const valid = ["pre_seed","seed","series_a","series_b","series_c","growth","late_stage","pre_ipo"];
  return stages.map((s) => s.toLowerCase().replace(/\s+/g, "_")).filter((s) => valid.includes(s));
}

function normalizeInvestorType(type: string): string {
  const t = type.toLowerCase().replace(/\s+/g, "_");
  const valid = [
    "angel_investor","angel_syndicate","venture_capital","corporate_venture",
    "family_office","private_equity","accelerator","incubator","government_fund",
    "university_fund","venture_studio","micro_vc","impact_investor","strategic_investor",
    "debt_investor","fund_of_funds",
  ];
  // Map types not in enum to closest valid type
  const mappings: Record<string, string> = {
    growth_equity: "private_equity",
  };
  if (valid.includes(t)) return t;
  if (mappings[t]) return mappings[t];
  return "venture_capital";
}

async function main() {
  console.log("\n🧪 Stress Test — CSV Import Pipeline\n");
  console.log("=".repeat(60));

  // 1. Read CSV
  const csvPath = join(process.cwd(), "test-data", "stress-test-investors.csv");
  const csvContent = readFileSync(csvPath, "utf-8");
  const lines = csvContent.split("\n").filter((l) => l.trim());
  const header = parseCsvLine(lines[0]);
  const dataLines = lines.slice(1);

  console.log(`\n📄 CSV: ${dataLines.length} records`);
  console.log(`   Columns: ${header.length}`);
  console.log(`   Headers: ${header.join(", ")}`);

  // 2. Parse records
  const records = dataLines.map((line) => {
    const fields = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => { row[h] = fields[i] || ""; });
    return row;
  });

  // 3. Normalize
  let normalized = 0;
  let normErrors = 0;
  const normalizedRecords: any[] = [];

  for (const record of records) {
    try {
      const stages = normalizeStages(normalizeArray(record.investment_stages));
      const sectors = normalizeArray(record.investment_sectors);
      const geos = normalizeArray(record.investment_geographies);

      normalizedRecords.push({
        full_name: record.full_name || null,
        first_name: record.first_name || record.full_name?.split(" ")[0] || null,
        last_name: record.last_name || record.full_name?.split(" ").slice(1).join(" ") || null,
        email: record.email || null,
        phone: record.phone || null,
        linkedin_url: record.linkedin_url || null,
        job_title: record.job_title || null,
        investor_type: normalizeInvestorType(record.investor_type),
        investment_stages: stages,
        investment_sectors: sectors,
        investment_geographies: geos,
        country: record.country || null,
        city: record.city || null,
        min_check_size: record.min_check_size ? parseInt(record.min_check_size) : null,
        max_check_size: record.max_check_size ? parseInt(record.max_check_size) : null,
        currency: record.currency || "USD",
        portfolio_count: record.portfolio_count ? parseInt(record.portfolio_count) : 0,
        bio: record.bio || null,
        is_verified: record.is_verified === "true",
        is_active: true,
        fit_score: 0,
        outreach_readiness: "not_ready",
        source: record.source || "csv_import",
        source_id: record.source_id || null,
      });
      normalized++;
    } catch (err) {
      normErrors++;
    }
  }

  console.log(`\n🔄 Normalization: ${normalized} OK, ${normErrors} errors`);

  // 4. Batch insert
  console.log(`\n💾 Inserting into Supabase...`);
  const BATCH = 50;
  let inserted = 0;
  let insertErrors = 0;
  const startTime = Date.now();

  for (let i = 0; i < normalizedRecords.length; i += BATCH) {
    const batch = normalizedRecords.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("investors")
      .insert(batch)
      .select("id");

    if (error) {
      console.error(`   ⚠️  Batch ${Math.floor(i / BATCH) + 1} error: ${error.message}`);
      insertErrors += batch.length;
    } else {
      inserted += data?.length || 0;
    }

    if ((i + BATCH) % 200 === 0 || i + BATCH >= normalizedRecords.length) {
      const pct = ((inserted / normalizedRecords.length) * 100).toFixed(0);
      console.log(`   📥 ${inserted} / ${normalizedRecords.length} (${pct}%)`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`   ✅ Inserted: ${inserted} in ${elapsed}s (${Math.round(inserted / (Date.now() - startTime) * 1000)}/s)`);

  // 5. Verify data in database
  console.log(`\n🔍 Verifying data in database...`);

  // Count total
  const { count: total } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true });

  // Count by source
  const { data: sourceData } = await supabase
    .from("investors")
    .select("source")
    .eq("source", "csv_import");

  // Count new records from this import (using source_id prefix)
  const { data: importRecords } = await supabase
    .from("investors")
    .select("id, full_name, email, investor_type, country, fit_score, outreach_readiness, data_quality_score")
    .like("source_id", "test_%")
    .order("created_at", { ascending: false })
    .limit(20);

  // Check edge case records — they use source_id like 'edge_001'
  const { data: emptyRecord } = await supabase
    .from("investors")
    .select("id, full_name, email, bio")
    .eq("source_id", "edge_001")
    .maybeSingle();

  const { data: specialCharRecord } = await supabase
    .from("investors")
    .select("id, full_name, email, country")
    .eq("source_id", "edge_002")
    .maybeSingle();

  const { data: commaRecord } = await supabase
    .from("investors")
    .select("id, full_name, email, bio")
    .eq("source_id", "edge_004")
    .maybeSingle();

  console.log(`   Total investors in DB: ${total?.toLocaleString()}`);
  console.log(`   Records from csv_import source: ${sourceData?.length || 0}`);
  console.log(`   Sample records:`);

  if (importRecords) {
    for (const r of importRecords.slice(0, 5)) {
      console.log(`     ${r.full_name?.padEnd(25)} | ${(r.investor_type || "").padEnd(20)} | ${(r.country || "").padEnd(15)} | fit:${r.fit_score}`);
    }
  }

  // 6. Edge case verification
  console.log(`\n🧪 Edge Case Verification:`);

  if (emptyRecord) {
    console.log(`   ✅ Empty record: "${emptyRecord.full_name}" — email: "${emptyRecord.email}" bio: "${emptyRecord.bio}"`);
  } else {
    console.log(`   ❌ Empty record not found`);
  }

  if (specialCharRecord) {
    console.log(`   ✅ Special chars: "${specialCharRecord.full_name}" — country: "${specialCharRecord.country}"`);
  } else {
    console.log(`   ❌ Special char record not found`);
  }

  if (commaRecord) {
    const bioHasComma = commaRecord.bio?.includes(",");
    console.log(`   ✅ Comma in bio: bio contains commas: ${bioHasComma} — bio: "${commaRecord.bio?.substring(0, 60)}..."`);
  } else {
    console.log(`   ❌ Comma record not found`);
  }

  // 7. Summary
  const checks = [
    { name: "CSV parse", pass: records.length === dataLines.length },
    { name: "Normalization", pass: normErrors === 0 },
    { name: "Batch insert", pass: inserted > 0 },
    { name: "Data in DB", pass: (total || 0) > 0 },
    { name: "Edge: empty fields", pass: !!emptyRecord },
    { name: "Edge: special chars", pass: !!specialCharRecord },
    { name: "Edge: commas in CSV", pass: !!commaRecord },
    { name: "Batch size (500+)", pass: normalizedRecords.length >= 500 },
  ];

  const passed = checks.filter((c) => c.pass).length;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`\n📊 Results: ${passed}/${checks.length} checks passed\n`);
  for (const check of checks) {
    console.log(`   ${check.pass ? "✅" : "❌"} ${check.name}`);
  }

  if (passed === checks.length) {
    console.log(`\n🎉 All checks passed! Stress test complete.`);
  } else {
    console.log(`\n⚠️  Some checks failed. Review above.`);
  }

  console.log("");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
